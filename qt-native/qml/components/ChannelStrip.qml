import QtQuick
import QtQuick.Layouts

Rectangle {
    id: root

    property string channelName: "MUSIC"
    property color accentColor: Theme.accent
    property real faderValue: -3.0
    property real trimValue: 0.0
    property real meterLevel: 0.5
    property bool muted: false
    property bool selected: false

    implicitWidth: 126
    implicitHeight: 250
    radius: Theme.radius
    color: selected ? "#151C21" : Theme.bgRaised
    border.width: 1
    border.color: selected ? accentColor : Theme.borderSoft

    Behavior on color { ColorAnimation { duration: 100 } }
    Behavior on border.color { ColorAnimation { duration: 100 } }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 8
        spacing: 4

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 20
            spacing: 5

            Rectangle {
                width: 4
                height: 12
                radius: 2
                color: root.accentColor
                opacity: root.selected ? 1 : 0.42
            }

            Text {
                Layout.fillWidth: true
                text: root.channelName
                color: root.selected ? Theme.text : Theme.textSoft
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textXS
                font.weight: Font.DemiBold
                elide: Text.ElideRight
                font.letterSpacing: 0.45
            }

            Rectangle {
                width: 5
                height: 5
                radius: 3
                color: root.muted ? Theme.red : root.meterLevel > 0.02 ? Theme.green : Theme.textDim
                opacity: root.muted ? 1 : 0.75
            }
        }

        StudioKnob {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 58
            Layout.preferredHeight: 68
            title: "TRIM"
            compact: true
            value: root.trimValue
            from: -12
            to: 12
            defaultValue: 0
            decimals: 1
            unit: "dB"
            accentColor: root.accentColor
            onValueEdited: function(v) { root.trimValue = v }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.minimumHeight: 126
            spacing: 7

            Item { Layout.fillWidth: true }

            LevelMeter {
                Layout.preferredWidth: 11
                Layout.fillHeight: true
                level: root.muted ? 0 : root.meterLevel
            }

            StudioFader {
                Layout.preferredWidth: 52
                Layout.fillHeight: true
                value: root.faderValue
                accentColor: root.accentColor
                selected: root.selected
                onValueEdited: function(v) { root.faderValue = v }
            }

            Item { Layout.fillWidth: true }
        }

        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 62
            Layout.preferredHeight: 24
            radius: Theme.radiusSmall
            color: root.selected ? Theme.accentFaint : "#0B0F12"
            border.width: 1
            border.color: root.selected ? root.accentColor : Theme.borderSoft

            Text {
                anchors.centerIn: parent
                text: root.faderValue <= -59.5 ? "-∞ dB" : root.faderValue.toFixed(1) + " dB"
                color: root.selected ? Theme.text : Theme.textSoft
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textXS
                font.weight: Font.DemiBold
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 27
            spacing: 5

            SoftButton {
                Layout.fillWidth: true
                compact: true
                text: "SEL"
                checked: root.selected
                onClicked: root.selected = !root.selected
            }

            SoftButton {
                Layout.fillWidth: true
                compact: true
                text: "MUTE"
                checked: root.muted
                danger: root.muted
                onClicked: root.muted = !root.muted
            }
        }
    }
}
