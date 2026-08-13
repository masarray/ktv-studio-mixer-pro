import QtQuick

Item {
    id: root

    property real level: 0.0
    property real displayLevel: level
    property real peakLevel: 0.0
    property bool stereo: false

    implicitWidth: 12
    implicitHeight: 150

    Behavior on displayLevel {
        SmoothedAnimation { velocity: 3.8 }
    }

    Behavior on peakLevel {
        SmoothedAnimation { velocity: 1.2 }
    }

    onLevelChanged: {
        var safe = Math.max(0, Math.min(1, level))
        if (safe > peakLevel) {
            peakLevel = safe
            peakHold.restart()
        }
    }

    Timer {
        id: peakHold
        interval: 720
        repeat: false
        onTriggered: root.peakLevel = root.level
    }

    Rectangle {
        anchors.fill: parent
        radius: width / 2
        color: "#0A0D10"
        border.width: 1
        border.color: Theme.borderSoft
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: 2
        height: Math.max(0, (parent.height - 4) * Math.min(root.displayLevel, 0.82))
        radius: Math.max(1, width / 2)
        color: Theme.accent
        opacity: 0.82
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 2 + (parent.height - 4) * 0.82
        anchors.leftMargin: 2
        anchors.rightMargin: 2
        height: Math.max(0, (parent.height - 4) * (Math.min(root.displayLevel, 0.94) - 0.82))
        color: Theme.amber
        opacity: 0.9
    }

    Rectangle {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 2 + (parent.height - 4) * 0.94
        anchors.leftMargin: 2
        anchors.rightMargin: 2
        height: Math.max(0, (parent.height - 4) * (root.displayLevel - 0.94))
        color: Theme.red
    }

    Rectangle {
        width: parent.width + 2
        height: 1
        x: -1
        y: 2 + (1 - root.peakLevel) * (parent.height - 4)
        color: root.peakLevel > 0.94 ? Theme.red : root.peakLevel > 0.82 ? Theme.amber : Theme.text
        opacity: root.peakLevel > 0.04 ? 0.92 : 0

        Behavior on y { SmoothedAnimation { velocity: 120 } }
    }
}
