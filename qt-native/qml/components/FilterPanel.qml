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
        spacing: 8
        Text { text: "HPF / LPF"; color: Theme.text; font.family: Theme.fontFamily; font.pixelSize: 9; font.weight: Font.Bold; font.letterSpacing: 0.7 }
        Rectangle { Layout.fillWidth: true; height: 1; color: Theme.borderSoft }
        ParameterSlider { Layout.fillWidth: true; label: "LPF"; value: root.engine.lpfHz; from: 20; to: 20000; step: 100; defaultValue: 20000; decimals: 0; unit: "Hz"; logarithmic: true; accentColor: Theme.accent; onValueEdited: function(v) { root.engine.lpfHz = v } }
        Text { text: "LP TYPE"; color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.DemiBold; font.letterSpacing: 0.6 }
        StudioComboBox {
            Layout.fillWidth: true
            Layout.preferredHeight: 34
            model: ["LP Bessel 12", "LP Butter 12", "LP Bessel 18", "LP Butter 18", "LP Bessel 24", "LP Butter 24", "LP LR 24"]
            value: root.engine.lpType
            onValueEdited: function(v) { root.engine.lpType = v }
        }
        Rectangle { Layout.fillWidth: true; height: 1; color: Theme.borderSoft }
        ParameterSlider { Layout.fillWidth: true; label: "HPF"; value: root.engine.hpfHz; from: 20; to: 20000; step: 5; defaultValue: 20; decimals: 0; unit: "Hz"; logarithmic: true; accentColor: Theme.accent; onValueEdited: function(v) { root.engine.hpfHz = v } }
        Text { text: "HP TYPE"; color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.DemiBold; font.letterSpacing: 0.6 }
        StudioComboBox {
            Layout.fillWidth: true
            Layout.preferredHeight: 34
            model: ["HP Bessel 12", "HP Butter 12", "HP Bessel 18", "HP Butter 18", "HP Bessel 24", "HP Butter 24", "HP LR 24"]
            value: root.engine.hpType
            onValueEdited: function(v) { root.engine.hpType = v }
        }
        Item { Layout.fillHeight: true }
    }
}
