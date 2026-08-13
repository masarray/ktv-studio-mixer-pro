import QtQuick

Rectangle {
    id: root

    property string text: "BUTTON"
    property bool checked: false
    property bool danger: false
    property bool compact: false
    signal clicked()

    implicitWidth: compact ? 54 : 72
    implicitHeight: compact ? 26 : 30
    radius: Theme.radiusSmall
    color: checked ? Theme.accentSoft : mouse.containsMouse ? Theme.control : "transparent"
    border.width: 1
    border.color: checked ? Theme.accent : mouse.containsMouse ? Theme.border : Theme.borderSoft

    Behavior on color { ColorAnimation { duration: 90 } }
    Behavior on border.color { ColorAnimation { duration: 90 } }

    Text {
        anchors.centerIn: parent
        text: root.text
        color: root.danger ? Theme.red : root.checked ? Theme.text : mouse.containsMouse ? Theme.text : Theme.textSoft
        font.family: Theme.fontFamily
        font.pixelSize: Theme.textXS
        font.weight: root.checked ? Font.DemiBold : Font.Medium
        font.letterSpacing: 0.3
    }

    MouseArea {
        id: mouse
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.clicked()
    }
}
