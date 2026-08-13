#include <QFont>
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQuickStyle>

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    app.setApplicationName(QStringLiteral("SONKUPIK STUDIO Native UI"));
    app.setOrganizationName(QStringLiteral("MasArray"));

    // The visual system intentionally uses a single proportional family.
    // The prototype expects Plus Jakarta Sans to be installed on the OS.
    QFont appFont(QStringLiteral("Plus Jakarta Sans"));
    appFont.setStyleStrategy(QFont::PreferAntialias);
    app.setFont(appFont);

    // Basic removes platform-heavy styling so every visible control is ours.
    QQuickStyle::setStyle(QStringLiteral("Basic"));

    QQmlApplicationEngine engine;
    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection);

    engine.loadFromModule(QStringLiteral("SonkupikStudio"), QStringLiteral("Main"));
    return app.exec();
}
