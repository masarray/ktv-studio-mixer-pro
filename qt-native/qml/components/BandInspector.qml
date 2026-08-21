import QtQuick
import QtQuick.Layouts

Rectangle {
    id: root
    property var bandModel: null
    property int bandIndex: 0
    property real frequency: 80
    property real gain: 0
    property real q: 1
    property color accentColor: Theme.accent
    signal frequencyEdited(real value)
    signal gainEdited(real value)
    signal qEdited(real value)
    signal resetRequested()

    implicitWidth: 516
    implicitHeight: 64
    radius: 9
    color: "#E30D1217"
    border.width: 1
    border.color: "#33414A"

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.leftMargin: 9
        anchors.rightMargin: 9
        height: 1
        color: root.accentColor
        opacity: 0.28
    }

    RowLayout {
        anchors.fill: parent
        anchors.margins: 7
        spacing: 7
        ColumnLayout {
            Layout.preferredWidth: 108
            spacing: 2
            Text { text: "BAND " + (root.bandIndex + 1) + "  •  TYPE"; color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.DemiBold }
            StudioComboBox {
                Layout.fillWidth: true
                Layout.preferredHeight: 30
                enabled: root.bandModel !== null
                model: ["BELL", "LOW SHELF", "HIGH SHELF"]
                value: root.bandModel ? root.bandModel.get(root.bandIndex).typeName : "BELL"
                accentColor: root.accentColor
                onValueEdited: function(v) { if (root.bandModel) root.bandModel.setBandType(root.bandIndex, v) }
            }
        }
        Rectangle { width: 1; Layout.fillHeight: true; color: Theme.borderSoft; opacity: 0.70 }
        ValueField { Layout.preferredWidth: 104; title: "FREQ"; value: root.frequency; from: 20; to: 20000; step: 5; defaultValue: root.frequency; decimals: 0; unit: "Hz"; accentColor: Theme.amber; onValueEdited: function(v) { root.frequencyEdited(v) } }
        ValueField { Layout.preferredWidth: 90; title: "GAIN"; value: root.gain; from: -24; to: 24; step: 0.1; defaultValue: 0; decimals: 1; unit: "dB"; accentColor: root.accentColor; onValueEdited: function(v) { root.gainEdited(v) } }
        ValueField { Layout.preferredWidth: 76; title: "Q"; value: root.q; from: 0.1; to: 30; step: 0.1; defaultValue: 1; decimals: 2; accentColor: Theme.textSoft; onValueEdited: function(v) { root.qEdited(v) } }
        SoftButton { Layout.preferredWidth: 56; Layout.preferredHeight: 30; text: "RESET"; compact: true; onClicked: root.resetRequested() }
    }
}
