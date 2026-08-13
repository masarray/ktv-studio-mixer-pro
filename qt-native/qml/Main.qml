import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: root
    visible: true
    width: 1540
    height: 940
    minimumWidth: 1220
    minimumHeight: 780
    title: "SONKUPIK STUDIO — Native Console P0"
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
            var jitter = (Math.random()-0.5)*0.05
            root.micALevel = Math.max(0.04,Math.min(0.88,0.34+Math.abs(Math.sin(root.phase*0.91))*0.34+jitter))
            root.micBLevel = Math.max(0.04,Math.min(0.84,0.28+Math.abs(Math.sin(root.phase*0.73+0.8))*0.31+jitter))
            root.musicLevel = Math.max(0.10,Math.min(0.96,0.48+Math.abs(Math.sin(root.phase*0.57+1.7))*0.36+jitter))
            root.echoLevel = Math.max(0.04,Math.min(0.78,root.micALevel*0.60+Math.abs(Math.sin(root.phase*0.43))*0.12))
            root.reverbLevel = Math.max(0.03,Math.min(0.72,root.micBLevel*0.52+Math.abs(Math.sin(root.phase*0.35+2.1))*0.13))
            root.masterLevel = Math.max(0.14,Math.min(0.99,root.musicLevel*0.72+Math.max(root.micALevel,root.micBLevel)*0.28))
        }
    }

    background: Rectangle { color: Theme.bg }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 58
            color: Theme.chassis

            Rectangle { anchors.left:parent.left; anchors.right:parent.right; anchors.bottom:parent.bottom; height:1; color:Theme.border }
            Rectangle { anchors.left:parent.left; anchors.right:parent.right; anchors.top:parent.top; height:1; color:"#FFFFFF"; opacity:0.045 }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 16
                anchors.rightMargin: 16
                spacing: 10

                Rectangle {
                    Layout.preferredWidth: 34
                    Layout.preferredHeight: 34
                    radius: 7
                    color: "#0A0E12"
                    border.width: 1
                    border.color: Theme.border
                    Text { anchors.centerIn:parent; text:"S"; color:Theme.accent; font.family:Theme.fontFamily; font.pixelSize:18; font.weight:Font.Bold }
                    Rectangle { width:10; height:2; rotation:-38; color:Theme.amber; anchors.centerIn:parent; anchors.horizontalCenterOffset:4; anchors.verticalCenterOffset:2 }
                }

                ColumnLayout {
                    spacing: -1
                    Text { text:"SONKUPIK STUDIO"; color:Theme.text; font.family:Theme.fontFamily; font.pixelSize:Theme.textL; font.weight:Font.DemiBold; font.letterSpacing:0.2 }
                    Text { text:"KARAOKE PROCESSOR · NATIVE"; color:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8; font.weight:Font.Medium; font.letterSpacing:1.15 }
                }

                Item { Layout.fillWidth: true }

                RowLayout {
                    spacing: 4
                    SoftButton { text:"◀"; compact:true }
                    SoftButton { text:"▶"; compact:true; checked:true }
                    SoftButton { text:"■"; compact:true }
                }

                Rectangle {
                    Layout.preferredWidth: 210
                    Layout.preferredHeight: 34
                    radius: 7
                    color: "#070A0D"
                    border.width: 1
                    border.color: Theme.borderSoft
                    Text { anchors.centerIn:parent; text:"KARAOKE ARTIST LUXURY"; color:Theme.amber; font.family:Theme.fontFamily; font.pixelSize:Theme.textS; font.weight:Font.Bold; font.letterSpacing:0.35 }
                }

                RowLayout {
                    spacing: 4
                    Rectangle { width:7; height:7; radius:4; color:Theme.green; opacity:0.75 }
                    Text { text:"LIVE"; color:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8; font.weight:Font.Bold; font.letterSpacing:0.8 }
                    SoftButton { text:"BT"; compact:true; checked:true }
                    SoftButton { text:"USB"; compact:true }
                    SoftButton { text:"CONNECT"; compact:true }
                }

                Rectangle {
                    Layout.preferredWidth: 74
                    Layout.preferredHeight: 28
                    radius: 6
                    color: Theme.amberFaint
                    border.width: 1
                    border.color: Theme.amberSoft
                    Text { anchors.centerIn:parent; text:"OFFLINE"; color:Theme.amber; font.family:Theme.fontFamily; font.pixelSize:8; font.weight:Font.Bold; font.letterSpacing:0.7 }
                }

                SoftButton { text:"IMPORT"; compact:true }
                SoftButton { text:"EXPORT"; compact:true; checked:true }
            }
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            Rectangle {
                Layout.preferredWidth: 164
                Layout.fillHeight: true
                color: "#0C1116"
                border.width: 0
                Rectangle { anchors.right:parent.right; anchors.top:parent.top; anchors.bottom:parent.bottom; width:1; color:Theme.border }

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 11
                    spacing: 5

                    Text { text:"SECTIONS"; color:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8; font.weight:Font.DemiBold; font.letterSpacing:1.2; leftPadding:6; bottomPadding:5 }

                    Repeater {
                        model: [
                            {name:"Music", sub:"Source & tone", code:"MU"},
                            {name:"Mic", sub:"Dual vocal input", code:"MI"},
                            {name:"Reverb", sub:"Room tail", code:"RV"},
                            {name:"Echo", sub:"Delay engine", code:"EC"},
                            {name:"Main", sub:"Front output", code:"MA"},
                            {name:"Surround", sub:"Rear field", code:"SR"},
                            {name:"Center", sub:"Vocal focus", code:"CE"},
                            {name:"Sub", sub:"Bass management", code:"SU"},
                            {name:"System", sub:"Global setup", code:"SY"}
                        ]
                        delegate: Rectangle {
                            required property var modelData
                            required property int index
                            Layout.fillWidth: true
                            Layout.preferredHeight: 47
                            radius: 7
                            color: index===0 ? Theme.accentFaint : mouse.containsMouse ? "#121920" : "transparent"
                            border.width: 1
                            border.color: index===0 ? Theme.accentSoft : mouse.containsMouse ? Theme.borderSoft : "transparent"

                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: 8
                                anchors.rightMargin: 6
                                spacing: 8
                                Rectangle {
                                    Layout.preferredWidth: 27
                                    Layout.preferredHeight: 27
                                    radius: 6
                                    color: index===0 ? "#123031" : "#11171D"
                                    border.width: 1
                                    border.color: index===0 ? Theme.accentSoft : Theme.borderSoft
                                    Text { anchors.centerIn:parent; text:modelData.code; color:index===0?Theme.accent:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:7; font.weight:Font.Bold }
                                }
                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: -1
                                    Text { text:modelData.name; color:index===0?Theme.accent:Theme.textSoft; font.family:Theme.fontFamily; font.pixelSize:Theme.textS; font.weight:Font.DemiBold }
                                    Text { text:modelData.sub; color:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8 }
                                }
                            }
                            MouseArea { id:mouse; anchors.fill:parent; hoverEnabled:true; cursorShape:Qt.PointingHandCursor }
                        }
                    }

                    Item { Layout.fillHeight: true }
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 50
                        radius: 7
                        color: "#090D11"
                        border.width: 1
                        border.color: Theme.borderSoft
                        Column { anchors.centerIn:parent; spacing:2; Text { anchors.horizontalCenter:parent.horizontalCenter; text:"UI PROTOTYPE"; color:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8; font.weight:Font.Bold; font.letterSpacing:0.7 } Text { anchors.horizontalCenter:parent.horizontalCenter; text:"P0 · MOCK DATA"; color:Theme.amber; font.family:Theme.fontFamily; font.pixelSize:8; font.weight:Font.DemiBold } }
                    }
                }
            }

            Item {
                Layout.fillWidth: true
                Layout.fillHeight: true

                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 11
                    spacing: 10

                    RowLayout {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        Layout.minimumHeight: 420
                        spacing: 10

                        EqGraph {
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            Layout.preferredWidth: 900
                        }

                        ColumnLayout {
                            Layout.preferredWidth: Math.max(370, root.width*0.27)
                            Layout.maximumWidth: 440
                            Layout.fillHeight: true
                            spacing: 10

                            CompressorGraph {
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                Layout.preferredHeight: 270
                            }
                            MusicControlPanel {
                                Layout.fillWidth: true
                                Layout.preferredHeight: 190
                            }
                        }
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 284
                        radius: Theme.radiusLarge
                        color: Theme.panel
                        border.width: 1
                        border.color: Theme.border

                        ColumnLayout {
                            anchors.fill: parent
                            anchors.margins: 9
                            spacing: 5

                            RowLayout {
                                Layout.fillWidth: true
                                Layout.preferredHeight: 22
                                Text { text:"Mixer"; color:Theme.text; font.family:Theme.fontFamily; font.pixelSize:Theme.textL; font.weight:Font.DemiBold }
                                Text { text:"LIVE LEVEL PREVIEW"; color:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8; font.weight:Font.DemiBold; font.letterSpacing:0.7 }
                                Item { Layout.fillWidth:true }
                                Text { text:"PEAK HOLD 720 ms"; color:Theme.textDim; font.family:Theme.fontFamily; font.pixelSize:8; font.weight:Font.Medium }
                            }

                            Rectangle {
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                radius: 7
                                color: "#0A0F13"
                                border.width: 1
                                border.color: Theme.borderSoft

                                RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: 5
                                    spacing: 0

                                    ChannelStrip { Layout.fillWidth:true; Layout.fillHeight:true; channelName:"MIC A"; accentColor:Theme.blue; faderValue:-3.0; trimValue:-0.1; meterLevel:root.micALevel }
                                    ChannelStrip { Layout.fillWidth:true; Layout.fillHeight:true; channelName:"MIC B"; accentColor:Theme.violet; faderValue:-3.0; trimValue:0; meterLevel:root.micBLevel }
                                    ChannelStrip { Layout.fillWidth:true; Layout.fillHeight:true; channelName:"MUSIC"; accentColor:Theme.accent; faderValue:0; trimValue:0; meterLevel:root.musicLevel; selected:true }
                                    ChannelStrip { Layout.fillWidth:true; Layout.fillHeight:true; channelName:"ECHO"; accentColor:"#73C5A4"; faderValue:-9.0; trimValue:0; meterLevel:root.echoLevel }
                                    ChannelStrip { Layout.fillWidth:true; Layout.fillHeight:true; channelName:"REVERB"; accentColor:"#B28BE0"; faderValue:-10.5; trimValue:0; meterLevel:root.reverbLevel }
                                    ChannelStrip { Layout.fillWidth:true; Layout.fillHeight:true; channelName:"MASTER"; accentColor:Theme.amber; faderValue:0; trimValue:0; meterLevel:root.masterLevel }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
