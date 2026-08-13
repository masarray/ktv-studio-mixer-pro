import QtQuick
import QtQuick.Layouts

Item {
    id: root

    property int key: 0
    property real slideOffset: 0
    property real slideOpacity: 1
    signal keyEdited(int newKey)
    implicitHeight: 62
    activeFocusOnTab: true

    function formatStep(step) {
        if (step < 0) return "♭" + Math.abs(step)
        if (step > 0) return "♯" + step
        return "0"
    }

    function commit(nextValue) {
        var next = Math.max(-7, Math.min(7, Math.round(nextValue)))
        if (next === root.key) return
        root.slideOffset = next > root.key ? 13 : -13
        root.slideOpacity = 0.48
        root.keyEdited(next)
        settleAnimation.restart()
    }

    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Left || event.key === Qt.Key_Down) {
            root.commit(root.key - 1)
            event.accepted = true
        } else if (event.key === Qt.Key_Right || event.key === Qt.Key_Up) {
            root.commit(root.key + 1)
            event.accepted = true
        } else if (event.key === Qt.Key_Home) {
            root.commit(0)
            event.accepted = true
        }
    }

    ParallelAnimation {
        id: settleAnimation
        NumberAnimation { target: root; property: "slideOffset"; to: 0; duration: 145; easing.type: Easing.OutCubic }
        NumberAnimation { target: root; property: "slideOpacity"; to: 1; duration: 115; easing.type: Easing.OutQuad }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 3

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 40
            spacing: 8

            SoftButton {
                Layout.preferredWidth: 34
                Layout.preferredHeight: 34
                transport: true
                iconOnly: true
                iconName: "chevron-left"
                accentIcon: true
                enabled: root.key > -7
                opacity: enabled ? 1 : 0.38
                onClicked: root.commit(root.key - 1)
            }

            Rectangle {
                id: tapeWindow
                Layout.fillWidth: true
                Layout.preferredHeight: 40
                radius: 7
                color: "#05080A"
                border.width: 1
                border.color: root.activeFocus ? Theme.focus : "#4A3B13"

                Rectangle {
                    anchors.fill: parent
                    anchors.margins: -4
                    radius: parent.radius + 4
                    color: Theme.amber
                    opacity: root.activeFocus ? 0.07 : 0.025
                    z: -3
                }

                Rectangle {
                    anchors.fill: parent
                    anchors.margins: 3
                    radius: 5
                    gradient: Gradient {
                        GradientStop { position: 0.0; color: "#090D11" }
                        GradientStop { position: 0.28; color: "#0B0D0D" }
                        GradientStop { position: 0.5; color: "#171307" }
                        GradientStop { position: 0.72; color: "#0B0D0D" }
                        GradientStop { position: 1.0; color: "#090D11" }
                    }
                }

                Rectangle {
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.top: parent.top
                    anchors.bottom: parent.bottom
                    anchors.topMargin: 4
                    anchors.bottomMargin: 4
                    width: 34
                    radius: 4
                    color: Theme.amber
                    opacity: 0.035
                }

                Rectangle {
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.top: parent.top
                    anchors.bottom: parent.bottom
                    anchors.topMargin: 5
                    anchors.bottomMargin: 5
                    width: 1
                    color: Theme.amber
                    opacity: 0.43
                }

                Rectangle {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.top: parent.top
                    anchors.leftMargin: 4
                    anchors.rightMargin: 4
                    height: 1
                    color: "#FFFFFF"
                    opacity: 0.08
                }

                Row {
                    anchors.centerIn: parent
                    x: Math.round((parent.width - width) / 2 + root.slideOffset)
                    opacity: root.slideOpacity
                    spacing: 0

                    Repeater {
                        model: 5
                        delegate: Item {
                            id: mark
                            required property int index
                            readonly property int stepValue: root.key + index - 2
                            width: 38
                            height: 28

                            Text {
                                anchors.centerIn: parent
                                text: mark.stepValue >= -7 && mark.stepValue <= 7 ? root.formatStep(mark.stepValue) : "·"
                                color: mark.index === 2 ? Theme.amber : Theme.textDim
                                opacity: mark.index === 2 ? 1 : 0.70
                                font.family: Theme.fontFamily
                                font.pixelSize: mark.index === 2 ? 13 : 9
                                font.weight: mark.index === 2 ? Font.Bold : Font.Medium
                                Behavior on color { ColorAnimation { duration: 80 } }
                            }

                            MouseArea {
                                anchors.fill: parent
                                enabled: mark.stepValue >= -7 && mark.stepValue <= 7
                                cursorShape: Qt.PointingHandCursor
                                onClicked: {
                                    root.forceActiveFocus()
                                    root.commit(mark.stepValue)
                                }
                            }
                        }
                    }
                }

                MouseArea {
                    anchors.fill: parent
                    acceptedButtons: Qt.NoButton
                    hoverEnabled: true
                    onWheel: function(event) {
                        root.forceActiveFocus()
                        root.commit(root.key + (event.angleDelta.y > 0 ? 1 : -1))
                        event.accepted = true
                    }
                }
            }

            SoftButton {
                Layout.preferredWidth: 34
                Layout.preferredHeight: 34
                transport: true
                iconOnly: true
                iconName: "chevron-right"
                accentIcon: true
                enabled: root.key < 7
                opacity: enabled ? 1 : 0.38
                onClicked: root.commit(root.key + 1)
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 16
            Layout.leftMargin: 42
            Layout.rightMargin: 42
            Text {
                text: "KEY DOWN"
                color: Theme.textDim
                font.family: Theme.fontFamily
                font.pixelSize: 7
                font.weight: Font.DemiBold
                font.letterSpacing: 0.55
            }
            Item { Layout.fillWidth: true }
            Text {
                text: root.key === 0 ? "ORIGINAL" : root.formatStep(root.key)
                color: root.key === 0 ? Theme.accent : Theme.amber
                font.family: Theme.fontFamily
                font.pixelSize: 8
                font.weight: Font.Bold
                font.letterSpacing: 0.75
            }
            Item { Layout.fillWidth: true }
            Text {
                text: "KEY UP"
                color: Theme.textDim
                font.family: Theme.fontFamily
                font.pixelSize: 7
                font.weight: Font.DemiBold
                font.letterSpacing: 0.55
            }
        }
    }
}
