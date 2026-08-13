import QtQuick

Rectangle {
    id: root

    property alias text: label.text
    property bool checked: false
    property bool compact: false
    property bool danger: false
    property bool amber: false
    signal clicked()

    implicitWidth: compact ? 52 : 70
    implicitHeight: compact ? 26 : 30
    radius: Theme.radiusSmall
    border.width: 1
    border.color: danger ? Theme.red : checked ? (amber ? Theme.amber : Theme.accent) : mouse.containsMouse ? Theme.highlight : Theme.borderSoft
    color: danger ? "#241315" : checked ? (amber ? Theme.amberFaint : Theme.accentFaint) : mouse.pressed ? "#172028" : mouse.containsMouse ? "#141B22" : "#0C1116"

    Behavior on color { ColorAnimation { duration: 90 } }
    Behavior on border.color { ColorAnimation { duration: 90 } }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        height: 1
        radius: parent.radius
        color: checked ? (amber ? Theme.amber : Theme.accent) : "#FFFFFF"
        opacity: checked ? 0.62 : 0.045
    }

    Text {
        id: label
        anchors.centerIn: parent
        color: danger ? "#FFD8D8" : checked ? Theme.text : Theme.textSoft
        font.family: Theme.fontFamily
        font.pixelSize: compact ? Theme.textXS : Theme.textS
        font.weight: checked ? Font.DemiBold : Font.Medium
        font.letterSpacing: 0.25
    }

    MouseArea {
        id: mouse
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.clicked()
    }
}
