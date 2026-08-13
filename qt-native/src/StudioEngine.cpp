#include "StudioEngine.h"

#include <QtMath>

namespace {
double clamp(double value, double minimum, double maximum)
{
    return qBound(minimum, value, maximum);
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
            {QStringLiteral("gain"), band.gain},
            {QStringLiteral("q"), band.q},
            {QStringLiteral("typeName"), band.typeName}};
}

void EqBandModel::setBand(int index, double frequency, double gain, double q)
{
    if (index < 0 || index >= m_bands.size())
        return;
    auto &band = m_bands[index];
    const double nextFrequency = clamp(frequency, 20.0, 20000.0);
    const double nextGain = clamp(gain, -24.0, 24.0);
    const double nextQ = clamp(q, 0.1, 30.0);
    if (qFuzzyCompare(band.frequency, nextFrequency)
        && qFuzzyCompare(band.gain + 25.0, nextGain + 25.0)
        && qFuzzyCompare(band.q, nextQ))
        return;
    band.frequency = nextFrequency;
    band.gain = nextGain;
    band.q = nextQ;
    emit dataChanged(this->index(index), this->index(index), {FrequencyRole, GainRole, QRole});
    emit bandChanged(index, band.frequency, band.gain, band.q);
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

StudioEngine::StudioEngine(QObject *parent)
    : QObject(parent)
{
    connect(&m_musicEqBands, &EqBandModel::bandChanged, this,
            [this](int index, double frequency, double gain, double q) {
        m_lastChangedPath = QStringLiteral("eq.music.bands.%1").arg(index);
        emit stateEdited(m_lastChangedPath,
                         QVariantMap{{QStringLiteral("frequency"), frequency},
                                     {QStringLiteral("gain"), gain},
                                     {QStringLiteral("q"), q}});
    });
}

#define DEFINE_DOUBLE_SETTER(Name, Member, Path, Minimum, Maximum, Notify) \
void StudioEngine::set##Name(double value) { \
    if (assign(Member, clamp(value, Minimum, Maximum), Path)) emit Notify(); \
}

void StudioEngine::setMusicKey(int value)
{
    if (assign(m_musicKey, qBound(-7, value, 7), "music.key")) emit musicKeyChanged();
}
DEFINE_DOUBLE_SETTER(NoiseGate, m_noiseGate, "music.noiseGateDb", -80.0, 0.0, noiseGateChanged)
DEFINE_DOUBLE_SETTER(Bass, m_bass, "music.bassDb", -12.0, 12.0, bassChanged)
DEFINE_DOUBLE_SETTER(Mid, m_mid, "music.midDb", -12.0, 12.0, midChanged)
DEFINE_DOUBLE_SETTER(MidFreq, m_midFreq, "music.midFreqHz", 80.0, 8000.0, midFreqChanged)
DEFINE_DOUBLE_SETTER(Treble, m_treble, "music.trebleDb", -12.0, 12.0, trebleChanged)
DEFINE_DOUBLE_SETTER(HpfHz, m_hpfHz, "eq.music.crossover.hpfHz", 20.0, 20000.0, hpfHzChanged)
DEFINE_DOUBLE_SETTER(LpfHz, m_lpfHz, "eq.music.crossover.lpfHz", 20.0, 20000.0, lpfHzChanged)
DEFINE_DOUBLE_SETTER(Input1Gain, m_input1Gain, "music.input1GainDb", -60.0, 10.0, input1GainChanged)
DEFINE_DOUBLE_SETTER(Input2Gain, m_input2Gain, "music.input2GainDb", -60.0, 10.0, input2GainChanged)
DEFINE_DOUBLE_SETTER(BluetoothGain, m_bluetoothGain, "music.bluetoothGainDb", -60.0, 10.0, bluetoothGainChanged)
DEFINE_DOUBLE_SETTER(UDiskGain, m_uDiskGain, "music.uDiskGainDb", -60.0, 10.0, uDiskGainChanged)
DEFINE_DOUBLE_SETTER(DigitalGain, m_digitalGain, "music.digitalGainDb", -60.0, 10.0, digitalGainChanged)
DEFINE_DOUBLE_SETTER(MasterMusic, m_masterMusic, "system.topMusicVol", 0.0, 100.0, masterMusicChanged)
DEFINE_DOUBLE_SETTER(MasterMic, m_masterMic, "system.topMicVol", 0.0, 100.0, masterMicChanged)
DEFINE_DOUBLE_SETTER(MasterFx, m_masterFx, "system.topEffectVol", 0.0, 100.0, masterFxChanged)

#undef DEFINE_DOUBLE_SETTER

void StudioEngine::setHpType(const QString &value)
{
    if (assign(m_hpType, value, "eq.music.crossover.hpType")) emit hpTypeChanged();
}

void StudioEngine::setLpType(const QString &value)
{
    if (assign(m_lpType, value, "eq.music.crossover.lpType")) emit lpTypeChanged();
}
