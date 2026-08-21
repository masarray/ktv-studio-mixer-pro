import QtQuick
import QtQuick.Layouts

Item {
    id: root

    property string channelName: "MUSIC"
    property color accentColor: Theme.accent
    property real faderValue: -3.0
    property real trimValue: 0.0
    property real meterLevel: 0.5
    property bool muted: false
    property bool selected: false

    implicitWidth: 132
    implicitHeight: 260

    Rectangle {
        anchors.fill: parent
        color: root.selected ? "#151D23" : "transparent"
        radius: 7
        opacity: root.selected ? 1 : 0
        Behavior on opacity { NumberAnimation { duration: 110 } }
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: 2
        radius: 1
        color: root.accentColor
        opacity: root.selected ? 1 : 0.26
    }

    Rectangle {
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        width: 1
        color: Theme.borderSoft
        opacity: 0.92
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 7
        spacing: 3

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 20
            spacing: 5

            Rectangle {
                width: 4
                height: 13
                radius: 2
                color: root.accentColor
            }

            Text {
                Layout.fillWidth: true
                text: root.channelName
                color: root.selected ? Theme.text : Theme.textSoft
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textS
                font.weight: Font.DemiBold
                font.letterSpacing: 0.4
                elide: Text.ElideRight
            }

            Rectangle {
                width: 5
                height: 5
                radius: 3
                color: root.muted ? Theme.red : root.meterLevel > 0.02 ? Theme.green : Theme.textFaint
                opacity: 0.85
            }
        }

        StudioKnob {
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredWidth: 72
            Layout.preferredHeight: 78
            compact: true
            title: "TRIM"
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
            Layout.minimumHeight: 130
            spacing: 5

            Item { Layout.fillWidth: true }

            LevelMeter {
                Layout.preferredWidth: 13
                Layout.fillHeight: true
                level: root.muted ? 0 : root.meterLevel
                peak: Math.min(1, (root.muted ? 0 : root.meterLevel) + 0.05)
            }

            StudioFader {
                Layout.preferredWidth: 64
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
            Layout.preferredWidth: 72
            Layout.preferredHeight: 22
            radius: 4
            color: "#080C10"
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
            Layout.preferredHeight: 25
            spacing: 4

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
