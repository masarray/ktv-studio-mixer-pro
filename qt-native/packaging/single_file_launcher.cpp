#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

#include <algorithm>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <string>
#include <vector>

namespace {

#pragma pack(push, 1)
struct PackageTrailer {
    char magic[16];
    std::uint64_t sevenZipSize;
    std::uint64_t sevenZipDllSize;
    std::uint64_t payloadSize;
};
#pragma pack(pop)

constexpr char kMagic[16] = {
    'S', 'O', 'N', 'K', 'U', 'P', 'I', 'K', '-', 'Q', 'T', '-', 'P', 'K', '1', '\0'
};

void showError(const std::wstring &message)
{
    MessageBoxW(nullptr, message.c_str(), L"SONKUPIK STUDIO", MB_OK | MB_ICONERROR);
}

bool readExact(HANDLE file, void *buffer, DWORD bytes)
{
    DWORD read = 0;
    return ReadFile(file, buffer, bytes, &read, nullptr) && read == bytes;
}

bool copySlice(HANDLE source, std::uint64_t offset, std::uint64_t size,
               const std::filesystem::path &destination)
{
    LARGE_INTEGER position{};
    position.QuadPart = static_cast<LONGLONG>(offset);
    if (!SetFilePointerEx(source, position, nullptr, FILE_BEGIN))
        return false;

    HANDLE output = CreateFileW(destination.c_str(), GENERIC_WRITE, 0, nullptr,
                                CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (output == INVALID_HANDLE_VALUE)
        return false;

    std::vector<unsigned char> buffer(1024 * 1024);
    std::uint64_t remaining = size;
    bool ok = true;
    while (remaining > 0) {
        const DWORD chunk = static_cast<DWORD>(std::min<std::uint64_t>(remaining, buffer.size()));
        DWORD read = 0;
        DWORD written = 0;
        if (!ReadFile(source, buffer.data(), chunk, &read, nullptr) || read != chunk
            || !WriteFile(output, buffer.data(), chunk, &written, nullptr) || written != chunk) {
            ok = false;
            break;
        }
        remaining -= chunk;
    }
    CloseHandle(output);
    return ok;
}

DWORD runAndWait(const std::filesystem::path &program, const std::wstring &arguments,
                 const std::filesystem::path &workingDirectory, bool hidden)
{
    std::wstring command = L"\"" + program.wstring() + L"\"";
    if (!arguments.empty())
        command += L" " + arguments;

    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    if (hidden) {
        startup.dwFlags = STARTF_USESHOWWINDOW;
        startup.wShowWindow = SW_HIDE;
    }
    PROCESS_INFORMATION process{};
    if (!CreateProcessW(nullptr, command.data(), nullptr, nullptr, FALSE,
                        hidden ? CREATE_NO_WINDOW : 0, nullptr,
                        workingDirectory.c_str(), &startup, &process)) {
        return static_cast<DWORD>(-1);
    }

    WaitForSingleObject(process.hProcess, INFINITE);
    DWORD exitCode = static_cast<DWORD>(-1);
    GetExitCodeProcess(process.hProcess, &exitCode);
    CloseHandle(process.hThread);
    CloseHandle(process.hProcess);
    return exitCode;
}

} // namespace

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int)
{
    wchar_t modulePath[MAX_PATH]{};
    if (!GetModuleFileNameW(nullptr, modulePath, MAX_PATH)) {
        showError(L"Tidak dapat membaca lokasi launcher.");
        return 1;
    }

    HANDLE package = CreateFileW(modulePath, GENERIC_READ, FILE_SHARE_READ, nullptr,
                                 OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (package == INVALID_HANDLE_VALUE) {
        showError(L"Tidak dapat membuka paket aplikasi.");
        return 2;
    }

    LARGE_INTEGER totalSize{};
    GetFileSizeEx(package, &totalSize);
    LARGE_INTEGER trailerPosition{};
    trailerPosition.QuadPart = totalSize.QuadPart - sizeof(PackageTrailer);
    SetFilePointerEx(package, trailerPosition, nullptr, FILE_BEGIN);

    PackageTrailer trailer{};
    if (!readExact(package, &trailer, sizeof(trailer))
        || memcmp(trailer.magic, kMagic, sizeof(kMagic)) != 0) {
        CloseHandle(package);
        showError(L"Paket aplikasi rusak atau tidak lengkap.");
        return 3;
    }

    const std::uint64_t embeddedSize = trailer.sevenZipSize
                                     + trailer.sevenZipDllSize
                                     + trailer.payloadSize;
    const std::uint64_t launcherSize = totalSize.QuadPart
                                     - sizeof(PackageTrailer)
                                     - embeddedSize;

    wchar_t tempBase[MAX_PATH]{};
    GetTempPathW(MAX_PATH, tempBase);
    const auto root = std::filesystem::path(tempBase)
                    / (L"SONKUPIK-STUDIO-" + std::to_wstring(GetCurrentProcessId()));
    const auto appDirectory = root / L"app";
    std::error_code error;
    std::filesystem::create_directories(appDirectory, error);
    if (error) {
        CloseHandle(package);
        showError(L"Tidak dapat membuat folder temporer.");
        return 4;
    }

    const auto sevenZip = root / L"7z.exe";
    const auto sevenZipDll = root / L"7z.dll";
    const auto payload = root / L"payload.7z";
    std::uint64_t offset = launcherSize;
    const bool extracted = copySlice(package, offset, trailer.sevenZipSize, sevenZip);
    offset += trailer.sevenZipSize;
    const bool dllExtracted = copySlice(package, offset, trailer.sevenZipDllSize, sevenZipDll);
    offset += trailer.sevenZipDllSize;
    const bool payloadExtracted = copySlice(package, offset, trailer.payloadSize, payload);
    CloseHandle(package);

    if (!extracted || !dllExtracted || !payloadExtracted) {
        std::filesystem::remove_all(root, error);
        showError(L"Tidak dapat mengekstrak isi paket.");
        return 5;
    }

    const std::wstring extractArguments = L"x -y -bso0 -bsp0 -bse0 -o\""
                                        + appDirectory.wstring() + L"\" \""
                                        + payload.wstring() + L"\"";
    if (runAndWait(sevenZip, extractArguments, root, true) != 0) {
        std::filesystem::remove_all(root, error);
        showError(L"Runtime Qt gagal diekstrak.");
        return 6;
    }

    const auto application = appDirectory / L"SONKUPIK-STUDIO-Native-UI.exe";
    const DWORD applicationExitCode = runAndWait(application, L"", appDirectory, false);
    std::filesystem::remove_all(root, error);

    if (applicationExitCode == static_cast<DWORD>(-1)) {
        showError(L"Aplikasi Qt gagal dijalankan.");
        return 7;
    }
    return static_cast<int>(applicationExitCode);
}
