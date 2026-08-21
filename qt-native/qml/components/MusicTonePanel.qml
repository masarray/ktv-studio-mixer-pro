import QtQuick
import QtQuick.Layouts

StudioPanel {
    id: root
    required property var engine

    implicitHeight: 286
    accentTop: true

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 11
        spacing: 5
        Text { text: "PITCH SHIFTER  ·  TONE"; color: Theme.text; font.family: Theme.fontFamily; font.pixelSize: 9; font.weight: Font.Bold; font.letterSpacing: 0.7 }
        Rectangle { Layout.fillWidth: true; height: 1; color: Theme.borderSoft }
        KeyControl { Layout.fillWidth: true; Layout.preferredHeight: 52; key: root.engine.musicKey; onKeyEdited: function(v) { root.engine.musicKey = v } }
        ParameterSlider { Layout.fillWidth: true; label: "NOISE GATE"; value: root.engine.noiseGate; from: -80; to: 0; step: 1; defaultValue: -70; decimals: 0; unit: "dB"; onValueEdited: function(v) { root.engine.noiseGate = v } }
        ParameterSlider { Layout.fillWidth: true; label: "BASS"; value: root.engine.bass; from: -12; to: 12; step: 0.1; defaultValue: 0; decimals: 1; unit: "dB"; onValueEdited: function(v) { root.engine.bass = v } }
        ParameterSlider { Layout.fillWidth: true; label: "MID"; value: root.engine.mid; from: -12; to: 12; step: 0.1; defaultValue: 0; decimals: 1; unit: "dB"; onValueEdited: function(v) { root.engine.mid = v } }
        ParameterSlider { Layout.fillWidth: true; label: "MID FREQ"; value: root.engine.midFreq; from: 80; to: 8000; step: 10; defaultValue: 1000; decimals: 0; unit: "Hz"; logarithmic: true; onValueEdited: function(v) { root.engine.midFreq = v } }
        ParameterSlider { Layout.fillWidth: true; label: "TREBLE"; value: root.engine.treble; from: -12; to: 12; step: 0.1; defaultValue: 0; decimals: 1; unit: "dB"; onValueEdited: function(v) { root.engine.treble = v } }
    }
}
