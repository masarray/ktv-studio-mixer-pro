import QtQuick
import QtQuick.Layouts

Item {
    id: root
    property int keyValue: 0
    signal keyEdited(int semitone)

    implicitHeight: 78

    ColumnLayout {
        anchors.fill: parent
        spacing: 6

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 22

            Text {
                text: "MUSIC KEY"
                color: Theme.textSoft
                font.family: Theme.fontFamily
                font.pixelSize: Theme.textXS
                font.weight: Font.DemiBold
                font.letterSpacing: 0.55
            }
            Item { Layout.fillWidth: true }
            Text {
                text: root.keyValue === 0 ? "ORIGINAL" : (root.keyValue > 0 ? "+" : "") + root.keyValue + " SEMITONE"
                color: root.keyValue === 0 ? Theme.textDim : Theme.accent
                font.family: Theme.fontFamily
                font.pixelSize: 9
                font.weight: Font.DemiBold
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 3

            Repeater {
                model: 13
                delegate: Rectangle {
                    required property int index
                    property int semitone: index - 6
                    Layout.fillWidth: true
                    Layout.preferredHeight: 34
                    radius: 4
                    color: root.keyValue === semitone ? Theme.accentSoft : keyMouse.containsMouse ? Theme.control : "#0B0F12"
                    border.width: 1
                    border.color: root.keyValue === semitone ? Theme.accent : keyMouse.containsMouse ? Theme.border : Theme.borderSoft

                    Text {
                        anchors.centerIn: parent
                        text: semitone === 0 ? "0" : semitone > 0 ? "+" + semitone : semitone
                        color: root.keyValue === semitone ? Theme.text : Theme.textSoft
                        font.family: Theme.fontFamily
                        font.pixelSize: 10
                        font.weight: root.keyValue === semitone ? Font.Bold : Font.Medium
                    }

                    MouseArea {
                        id: keyMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            root.keyValue = semitone
                            root.keyEdited(semitone)
                        }
                    }
                }
            }
        }
    }
}
