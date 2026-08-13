import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: root

    visible: true
    width: 1500
    height: 930
    minimumWidth: 1180
    minimumHeight: 760
    title: "SONKUPIK STUDIO — Native UI Prototype"
    color: Theme.bg

    property real phase: 0
    property real micALevel: 0.45
    property real micBLevel: 0.38
    property real musicLevel: 0.66
    property real echoLevel: 0.34
    property real reverbLevel: 0.29
    property real masterLevel: 0.73

    Timer {
        interval: 42
        running: true
        repeat: true
        onTriggered: {
            root.phase += 0.16
            var jitter = (Math.random() - 0.5) * 0.06
            root.micALevel = Math.max(0.05, Math.min(0.88, 0.38 + Math.abs(Math.sin(root.phase * 0.91)) * 0.32 + jitter))
            root.micBLevel = Math.max(0.04, Math.min(0.84, 0.30 + Math.abs(Math.sin(root.phase * 0.73 + 0.8)) * 0.30 + jitter))
            root.musicLevel = Math.max(0.10, Math.min(0.96, 0.48 + Math.abs(Math.sin(root.phase * 0.57 + 1.7)) * 0.36 + jitter))
            root.echoLevel = Math.max(0.04, Math.min(0.78, root.micALevel * 0.60 + Math.abs(Math.sin(root.phase * 0.43)) * 0.12))
            root.reverbLevel = Math.max(0.03, Math.min(0.72, root.micBLevel * 0.52 + Math.abs(Math.sin(root.phase * 0.35 + 2.1)) * 0.13))
            root.masterLevel = Math.max(0.14, Math.min(0.99, root.musicLevel * 0.72 + Math.max(root.micALevel, root.micBLevel) * 0.28))
        }
    }

    background: Rectangle { color: Theme.bg }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 52
            color: Theme.bgRaised
            border.width: 0

            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                height: 1
                color: Theme.borderSoft
            }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 18
                anchors.rightMargin: 18
                spacing: 12

                Row {
                    spacing: 9
                    Rectangle {
                        width: 18
                        height: 18
                        radius: 5
                        color: Theme.accent
                        anchors.verticalCenter: parent.verticalCenter
                        Rectangle {
                            width: 8; height: 8; radius: 3
                            anchors.centerIn: parent
                            color: Theme.bg
                        }
                    }
                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: "SONKUPIK STUDIO"
                        color: Theme.text
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.textL
                        font.weight: Font.DemiBold
                        font.letterSpacing: 0.35
                    }
                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: "NATIVE"
                        color: Theme.accent
                        font.family: Theme.fontFamily
                        font.pixelSize: 9
                        font.weight: Font.Bold
                        font.letterSpacing: 0.7
                    }
                }

                Item { Layout.fillWidth: true }

                RowLayout {
                    spacing: 4
                    SoftButton { text: "MIXER"; checked: true }
                    SoftButton { text: "MIC" }
                    SoftButton { text: "MUSIC" }
                    SoftButton { text: "FX" }
                    SoftButton { text: "OUTPUT" }
                    SoftButton { text: "SYSTEM" }
                }

                Item { Layout.fillWidth: true }

                Rectangle {
                    Layout.preferredWidth: 158
                    Layout.preferredHeight: 30
                    radius: Theme.radiusSmall
                    color: "#0B0F12"
                    border.width: 1
                    border.color: Theme.borderSoft
                    Row {
                        anchors.centerIn: parent
                        spacing: 7
                        Rectangle {
                            width: 6; height: 6; radius: 3
                            color: Theme.amber
                            anchors.verticalCenter: parent.verticalCenter
                        }
                        Text {
                            text: "UI PREVIEW • MOCK"
                            color: Theme.textSoft
                            font.family: Theme.fontFamily
                            font.pixelSize: 9
                            font.weight: Font.DemiBold
                            font.letterSpacing: 0.35
                        }
                    }
                }

                Rectangle {
                    Layout.preferredWidth: 176
                    Layout.preferredHeight: 30
                    radius: Theme.radiusSmall
                    color: Theme.control
                    border.width: 1
                    border.color: Theme.border
                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 9
                        anchors.rightMargin: 9
                        spacing: 6
                        Text {
                            Layout.fillWidth: true
                            text: "KARAOKE ARTIST"
                            color: Theme.text
                            font.family: Theme.fontFamily
                            font.pixelSize: 10
                            font.weight: Font.DemiBold
                            elide: Text.ElideRight
                        }
                        Text {
                            text: "⌄"
                            color: Theme.textDim
                            font.family: Theme.fontFamily
                            font.pixelSize: 13
                        }
                    }
                }
            }
        }

        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 14
                spacing: 12

                RowLayout {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    Layout.minimumHeight: 430
                    spacing: 12

                    EqGraph {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        Layout.preferredWidth: 930
                    }

                    ColumnLayout {
                        Layout.fillHeight: true
                        Layout.preferredWidth: Math.max(390, root.width * 0.29)
                        Layout.maximumWidth: 470
                        spacing: 12

                        CompressorGraph {
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            Layout.preferredHeight: 250
                        }

                        MusicControlPanel {
                            Layout.fillWidth: true
                            Layout.preferredHeight: 180
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 268
                    radius: Theme.radiusLarge
                    color: Theme.panel
                    border.width: 1
                    border.color: Theme.border

                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 10
                        spacing: 7

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.preferredHeight: 22

                            Text {
                                text: "MIXER"
                                color: Theme.text
                                font.family: Theme.fontFamily
                                font.pixelSize: Theme.textM
                                font.weight: Font.DemiBold
                                font.letterSpacing: 0.55
                            }
                            Text {
                                text: "LIVE LEVEL PREVIEW"
                                color: Theme.textDim
                                font.family: Theme.fontFamily
                                font.pixelSize: 9
                                font.weight: Font.Medium
                                font.letterSpacing: 0.45
                            }
                            Item { Layout.fillWidth: true }
                            Text {
                                text: "PEAK HOLD 720 ms"
                                color: Theme.textDim
                                font.family: Theme.fontFamily
                                font.pixelSize: 9
                                font.weight: Font.Medium
                            }
                        }

                        RowLayout {
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            spacing: 8

                            ChannelStrip {
                                Layout.fillWidth: true; Layout.fillHeight: true
                                channelName: "MIC A"; accentColor: Theme.blue
                                meterLevel: root.micALevel; faderValue: -3.0
                            }
                            ChannelStrip {
                                Layout.fillWidth: true; Layout.fillHeight: true
                                channelName: "MIC B"; accentColor: Theme.violet
                                meterLevel: root.micBLevel; faderValue: -3.0
                            }
                            ChannelStrip {
                                Layout.fillWidth: true; Layout.fillHeight: true
                                channelName: "MUSIC"; accentColor: Theme.accent
                                meterLevel: root.musicLevel; faderValue: 0.0; selected: true
                            }
                            ChannelStrip {
                                Layout.fillWidth: true; Layout.fillHeight: true
                                channelName: "ECHO"; accentColor: "#7FC6B6"
                                meterLevel: root.echoLevel; faderValue: -6.0
                            }
                            ChannelStrip {
                                Layout.fillWidth: true; Layout.fillHeight: true
                                channelName: "REVERB"; accentColor: "#B69BE6"
                                meterLevel: root.reverbLevel; faderValue: -8.0
                            }
                            ChannelStrip {
                                Layout.fillWidth: true; Layout.fillHeight: true
                                channelName: "MASTER"; accentColor: Theme.amber
                                meterLevel: root.masterLevel; faderValue: 0.0
                            }
                        }
                    }
                }
            }
        }
    }
}
