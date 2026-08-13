import QtQuick
import QtQuick.Layouts

StudioPanel {
    id: root
    required property var engine
    implicitHeight: 286
    accentTop: true

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 11
        spacing: 7
        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 16
            Layout.minimumHeight: 16
            Layout.maximumHeight: 16
            Text { text: "MASTER STRIP"; color: Theme.text; font.family: Theme.fontFamily; font.pixelSize: 9; font.weight: Font.Bold; font.letterSpacing: 0.7 }
            Item { Layout.fillWidth: true }
            Rectangle { Layout.preferredWidth: 7; Layout.preferredHeight: 7; radius: 4; color: Theme.amber }
        }
        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; Layout.minimumHeight: 1; Layout.maximumHeight: 1; color: Theme.borderSoft }
        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0
            InputFader { Layout.fillWidth: true; Layout.fillHeight: true; label: "MUSIC"; value: root.engine.masterMusic; onValueEdited: function(v) { root.engine.masterMusic = v }; from: 0; to: 100; accentColor: Theme.accent }
            InputFader { Layout.fillWidth: true; Layout.fillHeight: true; label: "MIC"; value: root.engine.masterMic; onValueEdited: function(v) { root.engine.masterMic = v }; from: 0; to: 100; accentColor: Theme.blue }
            InputFader { Layout.fillWidth: true; Layout.fillHeight: true; label: "FX"; value: root.engine.masterFx; onValueEdited: function(v) { root.engine.masterFx = v }; from: 0; to: 100; accentColor: Theme.violet }
        }
    }
}
