import QtQuick
import QtQuick.Layouts

Rectangle {
    id: root

    property int keyValue: 0
    property real bass: 1.2
    property real body: 0.0
    property real air: 1.8

    implicitHeight: 178
    radius: Theme.radiusLarge
    color: Theme.panel
    border.width: 1
    border.color: Theme.border

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 23

            Text {
                text: "MUSIC"
                color: Theme.text
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textM
                font.weight: Font.DemiBold
                font.letterSpacing: 0.55
            }
            Item { Layout.fillWidth: true }
            SoftButton { text: "RESET"; compact: true; onClicked: { root.keyValue = 0; root.bass = 0; root.body = 0; root.air = 0 } }
        }

        KeyControl {
            Layout.fillWidth: true
            Layout.preferredHeight: 66
            keyValue: root.keyValue
            onKeyEdited: function(v) { root.keyValue = v }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 8

            StudioKnob {
                Layout.fillWidth: true
                compact: true
                title: "BASS"
                value: root.bass
                from: -6; to: 6; defaultValue: 0
                decimals: 1; unit: "dB"
                accentColor: Theme.blue
                onValueEdited: function(v) { root.bass = v }
            }
            StudioKnob {
                Layout.fillWidth: true
                compact: true
                title: "BODY"
                value: root.body
                from: -6; to: 6; defaultValue: 0
                decimals: 1; unit: "dB"
                accentColor: Theme.violet
                onValueEdited: function(v) { root.body = v }
            }
            StudioKnob {
                Layout.fillWidth: true
                compact: true
                title: "AIR"
                value: root.air
                from: -6; to: 6; defaultValue: 0
                decimals: 1; unit: "dB"
                accentColor: Theme.accent
                onValueEdited: function(v) { root.air = v }
            }
        }
    }
}
