import QtQuick
import QtQuick.Layouts

StudioPanel {
    id: root
    property int bandIndex: 0
    property real frequency: 80
    property real gain: 0
    property real q: 1
    signal frequencyEdited(real value)
    signal gainEdited(real value)
    signal qEdited(real value)
    signal resetRequested()

    implicitHeight: 330
    accentTop: true

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 10
        Text { text: "MUSIC  ·  B" + (root.bandIndex + 1); color: Theme.text; font.family: Theme.fontFamily; font.pixelSize: 9; font.weight: Font.Bold; font.letterSpacing: 0.65 }
        Rectangle { Layout.fillWidth: true; height: 1; color: Theme.borderSoft }
        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 54
            Rectangle {
                Layout.preferredWidth: 102
                Layout.fillHeight: true
                radius: 7
                color: "#100E08"
                border.width: 1
                border.color: Theme.amberSoft
                Row { anchors.centerIn: parent; spacing: 4; Text { text: (root.gain > 0 ? "+" : "") + root.gain.toFixed(1); color: Theme.amber; font.family: Theme.fontFamily; font.pixelSize: 20; font.weight: Font.Bold } Text { text: "dB"; color: Theme.amber; opacity: 0.75; font.family: Theme.fontFamily; font.pixelSize: 9; anchors.baseline: parent.children[0].baseline } }
            }
            Item { Layout.fillWidth: true }
            Text { text: "P  ·  " + Math.round(root.frequency) + "Hz  ·  Q" + root.q.toFixed(2); color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.DemiBold }
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            ValueField { Layout.fillWidth: true; title: "FREQ  ·  HZ"; value: root.frequency; from: 20; to: 20000; step: 5; defaultValue: 1000; decimals: 0; unit: "Hz"; accentColor: Theme.amber; onValueEdited: function(v) { root.frequencyEdited(v) } }
            ValueField { Layout.fillWidth: true; title: "GAIN  ·  DB"; value: root.gain; from: -24; to: 24; step: 0.1; defaultValue: 0; decimals: 1; unit: "dB"; accentColor: Theme.accent; onValueEdited: function(v) { root.gainEdited(v) } }
        }
        ValueField { Layout.fillWidth: true; title: "Q  ·  BANDWIDTH"; value: root.q; from: 0.1; to: 30; step: 0.1; defaultValue: 1; decimals: 2; accentColor: Theme.violet; onValueEdited: function(v) { root.qEdited(v) } }
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 44
            radius: 6
            color: Theme.recessed
            border.width: 1
            border.color: Theme.borderSoft
            Column { anchors.centerIn: parent; spacing: 3; Text { anchors.horizontalCenter: parent.horizontalCenter; text: "DRAG NODE = FREQ / GAIN"; color: Theme.textDim; font.family: Theme.fontFamily; font.pixelSize: 8; font.weight: Font.DemiBold } Text { anchors.horizontalCenter: parent.horizontalCenter; text: "WHEEL OR CTRL + DRAG = Q  ·  SHIFT = FINE"; color: Theme.accent; font.family: Theme.fontFamily; font.pixelSize: 7; font.weight: Font.DemiBold } }
        }
        Item { Layout.fillHeight: true }
        SoftButton { Layout.fillWidth: true; Layout.preferredHeight: 32; text: "RESET BAND"; onClicked: root.resetRequested() }
    }
}
