import QtQuick

Rectangle {
    id: root

    property bool inset: false
    property bool accentTop: false
    property color accentColor: Theme.accent

    radius: Theme.radiusLarge
    border.width: 1
    border.color: inset ? "#05080A" : Theme.border
    gradient: Gradient {
        GradientStop { position: 0.0; color: root.inset ? "#06090C" : "#202932" }
        GradientStop { position: 0.18; color: root.inset ? "#080C10" : "#192129" }
        GradientStop { position: 0.62; color: root.inset ? "#070A0D" : "#141B22" }
        GradientStop { position: 1.0; color: root.inset ? "#050709" : "#10161C" }
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.leftMargin: parent.radius
        anchors.rightMargin: parent.radius
        height: 1
        color: root.accentTop ? root.accentColor : "#FFFFFF"
        opacity: root.accentTop ? 0.55 : 0.09
    }
    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.leftMargin: parent.radius
        anchors.rightMargin: parent.radius
        height: 1
        color: "#000000"
        opacity: 0.58
    }
}
