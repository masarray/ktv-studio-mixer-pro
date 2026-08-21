import QtQuick
import QtQuick.Layouts

Rectangle {
    id: root

    property int musicKey: 0
    property real bass: 1.2
    property real body: 0.0
    property real air: 1.8

    implicitHeight: 190
    radius: Theme.radiusLarge
    color: Theme.panel
    border.width: 1
    border.color: Theme.border

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: 1
        color: "#FFFFFF"
        opacity: 0.045
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 8

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 22
            Text {
                text: "Music"
                color: Theme.text
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textL
                font.weight: Font.DemiBold
            }
            Text {
                text: "KEY & TONE"
                color: Theme.textDim
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textXS
                font.weight: Font.DemiBold
                font.letterSpacing: 0.7
            }
            Item { Layout.fillWidth: true }
            SoftButton { text: "RESET"; compact: true; onClicked: { root.musicKey = 0; root.bass = 0; root.body = 0; root.air = 0 } }
        }

        Text {
            text: "MUSIC KEY"
            color: Theme.textDim
            font.family: Theme.fontFamily
            font.pixelSize: Theme.textXS
            font.weight: Font.DemiBold
            font.letterSpacing: 0.6
        }

        KeyControl {
            Layout.fillWidth: true
            Layout.preferredHeight: 58
            key: root.musicKey
            onKeyEdited: function(k) { root.musicKey = k }
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
                from: -6; to: 6; defaultValue: 0; decimals: 1; unit: "dB"
                accentColor: Theme.accent
                onValueEdited: function(v) { root.bass = v }
            }
            StudioKnob {
                Layout.fillWidth: true
                compact: true
                title: "BODY"
                value: root.body
                from: -6; to: 6; defaultValue: 0; decimals: 1; unit: "dB"
                accentColor: Theme.violet
                onValueEdited: function(v) { root.body = v }
            }
            StudioKnob {
                Layout.fillWidth: true
                compact: true
                title: "AIR"
                value: root.air
                from: -6; to: 6; defaultValue: 0; decimals: 1; unit: "dB"
                accentColor: Theme.amber
                onValueEdited: function(v) { root.air = v }
            }
        }
    }
}
