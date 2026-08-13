import QtQuick
import QtQuick.Layouts

Item {
    id: root

    property int key: 0
    signal keyEdited(int newKey)
    implicitHeight: 72

    RowLayout {
        anchors.fill: parent
        spacing: 7

        SoftButton {
            Layout.preferredWidth: 34
            Layout.preferredHeight: 34
            text: "‹"
            onClicked: { root.key = Math.max(-6, root.key - 1); root.keyEdited(root.key) }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 52
            radius: 7
            color: "#06090C"
            border.width: 1
            border.color: Theme.borderSoft

            Rectangle {
                anchors.fill: parent
                anchors.margins: 5
                radius: 5
                gradient: Gradient {
                    orientation: Gradient.Horizontal
                    GradientStop { position: 0.0; color: "#090D11" }
                    GradientStop { position: 0.5; color: "#14130B" }
                    GradientStop { position: 1.0; color: "#090D11" }
                }
            }

            Row {
                anchors.centerIn: parent
                spacing: 12
                Repeater {
                    model: [-2, -1, 0, 1, 2]
                    delegate: Text {
                        required property var modelData
                        text: modelData > 0 ? "♯" + modelData : modelData < 0 ? "♭" + Math.abs(modelData) : "0"
                        color: root.key === modelData ? Theme.amber : modelData === 0 ? Theme.textSoft : Theme.textDim
                        opacity: root.key === modelData ? 1 : 0.72
                        font.family: Theme.fontFamily
                        font.pixelSize: root.key === modelData ? 14 : 10
                        font.weight: root.key === modelData ? Font.Bold : Font.Medium
                        Behavior on color { ColorAnimation { duration: 90 } }
                    }
                }
            }

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.bottom: parent.bottom
                anchors.bottomMargin: 3
                text: root.key === 0 ? "ORIGINAL" : root.key > 0 ? "KEY UP" : "KEY DOWN"
                color: root.key === 0 ? Theme.accent : Theme.textDim
                font.family: Theme.fontFamily
                font.pixelSize: 8
                font.weight: Font.DemiBold
                font.letterSpacing: 0.7
            }
        }

        SoftButton {
            Layout.preferredWidth: 34
            Layout.preferredHeight: 34
            text: "›"
            onClicked: { root.key = Math.min(6, root.key + 1); root.keyEdited(root.key) }
        }
    }
}
