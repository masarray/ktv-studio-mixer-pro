#include "StudioEngine.h"

#include <QtMath>

namespace {
double clampValue(double value, double minimum, double maximum)
{
    return qBound(minimum, value, maximum);
}

QString normalizeBandType(const QString &value)
{
    const QString upper = value.trimmed().toUpper();
    if (upper == QStringLiteral("LS") || upper == QStringLiteral("LOW SHELF") || upper == QStringLiteral("LOWSHELF"))
        return QStringLiteral("LOW SHELF");
    if (upper == QStringLiteral("HS") || upper == QStringLiteral("HIGH SHELF") || upper == QStringLiteral("HIGHSHELF"))
        return QStringLiteral("HIGH SHELF");
    return QStringLiteral("BELL");
}
}

EqBandModel::EqBandModel(QObject *parent)
    : QAbstractListModel(parent)
{
    resetAll();
}

int EqBandModel::rowCount(const QModelIndex &parent) const
{
    return parent.isValid() ? 0 : m_bands.size();
}

QVariant EqBandModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_bands.size())
        return {};
    const auto &band = m_bands.at(index.row());
    switch (role) {
    case FrequencyRole: return band.frequency;
    case GainRole: return band.gain;
    case QRole: return band.q;
    case TypeNameRole: return band.typeName;
    default: return {};
    }
}

QHash<int, QByteArray> EqBandModel::roleNames() const
{
    return {{FrequencyRole, "freq"}, {GainRole, "gain"}, {QRole, "q"}, {TypeNameRole, "typeName"}};
}

QVariantMap EqBandModel::get(int index) const
{
    if (index < 0 || index >= m_bands.size())
        return {};
    const auto &band = m_bands.at(index);
    return {{QStringLiteral("freq"), band.frequency},
            {QStringLiteral("frequency"), band.frequency},
            {QStringLiteral("gain"), band.gain},
            {QStringLiteral("q"), band.q},
            {QStringLiteral("typeName"), band.typeName}};
}

void EqBandModel::setBand(int index, double frequency, double gain, double q)
{
    if (index < 0 || index >= m_bands.size())
        return;
    auto &band = m_bands[index];
    const double nextFrequency = clampValue(frequency, 20.0, 20000.0);
    const double nextGain = clampValue(gain, -24.0, 24.0);
    const double nextQ = clampValue(q, 0.1, 30.0);
    if (qFuzzyCompare(band.frequency, nextFrequency)
        && qFuzzyCompare(band.gain + 25.0, nextGain + 25.0)
        && qFuzzyCompare(band.q, nextQ))
        return;
    band.frequency = nextFrequency;
    band.gain = nextGain;
    band.q = nextQ;
    emit dataChanged(this->index(index), this->index(index), {FrequencyRole, GainRole, QRole});
    emit bandChanged(index, band.frequency, band.gain, band.q, band.typeName);
}

void EqBandModel::setBandType(int index, const QString &typeName)
{
    if (index < 0 || index >= m_bands.size())
        return;
    auto &band = m_bands[index];
    const QString normalized = normalizeBandType(typeName);
    if (band.typeName == normalized)
        return;
    band.typeName = normalized;
    emit dataChanged(this->index(index), this->index(index), {TypeNameRole});
    emit bandChanged(index, band.frequency, band.gain, band.q, band.typeName);
}

void EqBandModel::resetBand(int index)
{
    if (index < 0 || index >= m_bands.size())
        return;
    const auto &band = m_bands.at(index);
    setBand(index, band.frequency, 0.0, 1.0);
}

void EqBandModel::resetAll()
{
    const QList<double> frequencies{80, 160, 315, 630, 1300, 2500, 8000};
    beginResetModel();
    m_bands.clear();
    for (const double frequency : frequencies)
        m_bands.append({frequency, 0.0, 1.0, QStringLiteral("BELL")});
    endResetModel();
}

void EqBandModel::setHpfHz(double value)
{
    emit hpfEditRequested(clampValue(value, 20.0, 20000.0));
}

void EqBandModel::setLpfHz(double value)
{
    emit lpfEditRequested(clampValue(value, 20.0, 20000.0));
}

void EqBandModel::syncCrossover(double hpfHz, double lpfHz,
                                const QString &hpType, const QString &lpType)
{
    const double nextHpf = clampValue(hpfHz, 20.0, 20000.0);
    const double nextLpf = clampValue(lpfHz, 20.0, 20000.0);
    if (qFuzzyCompare(m_hpfHz, nextHpf)
        && qFuzzyCompare(m_lpfHz, nextLpf)
        && m_hpType == hpType
        && m_lpType == lpType)
        return;
    m_hpfHz = nextHpf;
    m_lpfHz = nextLpf;
    m_hpType = hpType;
    m_lpType = lpType;
    emit crossoverChanged();
}

StudioEngine::StudioEngine(QObject *parent)
    : QObject(parent)
{
    connect(&m_musicEqBands, &EqBandModel::bandChanged, this,
            [this](int index, double frequency, double gain, double q, const QString &typeName) {
        m_lastChangedPath = QStringLiteral("eq.music.bands.%1").arg(index);
        emit stateEdited(m_lastChangedPath,
                         QVariantMap{{QStringLiteral("frequency"), frequency},
                                     {QStringLiteral("gain"), gain},
                                     {QStringLiteral("q"), q},
                                     {QStringLiteral("type"), typeName}});
    });
    connect(&m_musicEqBands, &EqBandModel::hpfEditRequested, this, &StudioEngine::setHpfHz);
    connect(&m_musicEqBands, &EqBandModel::lpfEditRequested, this, &StudioEngine::setLpfHz);
    syncMusicCrossoverModel();
}

void StudioEngine::setMusicKey(int value)
{
    if (assign(m_musicKey, qBound(-7, value, 7), "music.key")) emit musicKeyChanged();
}

void StudioEngine::setNoiseGate(double value)
{
    if (assign(m_noiseGate, clampValue(value, -80.0, 0.0), "music.noiseGateDb")) emit noiseGateChanged();
}

void StudioEngine::setBass(double value)
{
    if (assign(m_bass, clampValue(value, -12.0, 12.0), "music.bassDb")) emit bassChanged();
}

void StudioEngine::setMid(double value)
{
    if (assign(m_mid, clampValue(value, -12.0, 12.0), "music.midDb")) emit midChanged();
}

void StudioEngine::setMidFreq(double value)
{
    if (assign(m_midFreq, clampValue(value, 80.0, 8000.0), "music.midFreqHz")) emit midFreqChanged();
}

void StudioEngine::setTreble(double value)
{
    if (assign(m_treble, clampValue(value, -12.0, 12.0), "music.trebleDb")) emit trebleChanged();
}

void StudioEngine::setHpfHz(double value)
{
    if (!assign(m_hpfHz, clampValue(value, 20.0, 20000.0), "eq.music.crossover.hpfHz")) return;
    syncMusicCrossoverModel();
    emit hpfHzChanged();
}

void StudioEngine::setLpfHz(double value)
{
    if (!assign(m_lpfHz, clampValue(value, 20.0, 20000.0), "eq.music.crossover.lpfHz")) return;
    syncMusicCrossoverModel();
    emit lpfHzChanged();
}

void StudioEngine::setHpType(const QString &value)
{
    if (!assign(m_hpType, value, "eq.music.crossover.hpType")) return;
    syncMusicCrossoverModel();
    emit hpTypeChanged();
}

void StudioEngine::setLpType(const QString &value)
{
    if (!assign(m_lpType, value, "eq.music.crossover.lpType")) return;
    syncMusicCrossoverModel();
    emit lpTypeChanged();
}

void StudioEngine::setInput1Gain(double value)
{
    if (assign(m_input1Gain, clampValue(value, -60.0, 10.0), "music.input1GainDb")) emit input1GainChanged();
}

void StudioEngine::setInput2Gain(double value)
{
    if (assign(m_input2Gain, clampValue(value, -60.0, 10.0), "music.input2GainDb")) emit input2GainChanged();
}

void StudioEngine::setBluetoothGain(double value)
{
    if (assign(m_bluetoothGain, clampValue(value, -60.0, 10.0), "music.bluetoothGainDb")) emit bluetoothGainChanged();
}

void StudioEngine::setUDiskGain(double value)
{
    if (assign(m_uDiskGain, clampValue(value, -60.0, 10.0), "music.uDiskGainDb")) emit uDiskGainChanged();
}

void StudioEngine::setDigitalGain(double value)
{
    if (assign(m_digitalGain, clampValue(value, -60.0, 10.0), "music.digitalGainDb")) emit digitalGainChanged();
}

void StudioEngine::setMasterMusic(double value)
{
    if (assign(m_masterMusic, clampValue(value, 0.0, 100.0), "system.topMusicVol")) emit masterMusicChanged();
}

void StudioEngine::setMasterMic(double value)
{
    if (assign(m_masterMic, clampValue(value, 0.0, 100.0), "system.topMicVol")) emit masterMicChanged();
}

void StudioEngine::setMasterFx(double value)
{
    if (assign(m_masterFx, clampValue(value, 0.0, 100.0), "system.topEffectVol")) emit masterFxChanged();
}

void StudioEngine::syncMusicCrossoverModel()
{
    m_musicEqBands.syncCrossover(m_hpfHz, m_lpfHz, m_hpType, m_lpType);
}
