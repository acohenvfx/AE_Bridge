#!/usr/bin/env python3
"""Build the AE Bridge guide in the Elemental Bender guide's visual style.
Content checked against the local panel/helper source on 2026-10-20.
Run: python3 tools/build_user_guide.py
"""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf/AE_Bridge_User_Guide.pdf'
C={k:HexColor(v) for k,v in dict(bg='#0a111b',panel='#121e2e',text='#eef5fb',body='#d5e0ec',muted='#8aa4bf',dim='#5d7a99',gold='#c9aa58',blue='#7c9ef8',line='#1b2b3d',warn='#fbbf24').items()}
c=canvas.Canvas(str(OUT),pagesize=(612,792))
c.setTitle('AE Bridge - User Guide'); c.setAuthor('Pragmatic Fox'); c.setSubject('Avid Media Composer and After Effects round-trip user manual')
y=0

def text(x,top,s,size=10,color='body',bold=False):
 c.setFillColor(C[color]); c.setFont('Helvetica-Bold' if bold else 'Helvetica',size); c.drawString(x,792-top-size,s)

def para(s,x=86,w=462,size=10,color='body',bold=False):
 global y
 st=ParagraphStyle('p',fontName='Helvetica-Bold' if bold else 'Helvetica',fontSize=size,leading=size*1.45,textColor=C[color])
 p=Paragraph(s,st); _,h=p.wrap(w,700)
 p.drawOn(c,x,792-y-h); y+=h
 return h

def page(n,section,title,desc):
 global y
 c.setFillColor(C['bg']); c.rect(0,0,612,792,fill=1,stroke=0)
 c.bookmarkPage(f'p{n}');c.addOutlineEntry(title,f'p{n}',0,False)
 text(40,15,section.upper(),8,'gold');text(502,15,'AE BRIDGE',7.5,'dim',True)
 c.setStrokeColor(C['line']);c.line(54,46,558,46)
 text(54,754,'AE Bridge Panel  |  User Guide',8,'dim');text(542,754,str(n),8,'dim')
 c.setFillColor(C['gold']);c.rect(0,0,612,3,fill=1,stroke=0)
 c.setFillColor(C['panel']);c.roundRect(54,660,504,86,8,fill=1,stroke=0)
 c.setFillColor(C['blue']);c.roundRect(54,660,4,86,2,fill=1,stroke=0)
 text(70,57,section.upper(),8,'blue');text(70,74,title,22,'text',True)
 y=109;para(desc,x=70,w=470,size=9.5,color='muted');y=147

def heading(s):
 global y
 y+=10;text(54,y,s.upper(),9,'blue',True);y+=19
 c.setStrokeColor(C['line']);c.line(54,792-y+1,558,792-y+1);y+=4

def step(n,title,body):
 global y
 c.setStrokeColor(C['blue']);c.setFillColor(C['panel']);c.circle(65,792-y-10,11,fill=1,stroke=1)
 text(62,y+3,str(n),9.5,'blue',True)
 para(title,size=11,color='text',bold=True);y+=3;para(body);y+=13

def note(label,body,warn=False):
 global y
 y+=6; start=y
 st=ParagraphStyle('box',fontName='Helvetica',fontSize=9.5,leading=14,textColor=C['body'])
 p=Paragraph(body,st);_,h=p.wrap(474,600)
 height=h+38
 c.setFillColor(HexColor('#1c1d1a') if warn else C['panel']);c.roundRect(54,792-y-height,504,height,6,fill=1,stroke=0)
 c.setFillColor(C['warn'] if warn else C['blue']);c.rect(54,792-y-height,3,height,fill=1,stroke=0)
 text(66,y+8,label.upper(),8,'warn' if warn else 'blue',True)
 p.drawOn(c,66,792-y-26-h);y+=height+12

def row(label,body):
 global y
 text(54,y,label,10,'text',True);y+=18;para(body,x=54,w=504);y+=12

def end():
 if y>722: raise ValueError(f'Page overflow: {y}')
 c.showPage()

# Cover
c.setFillColor(C['bg']);c.rect(0,0,612,792,fill=1,stroke=0)
c.setFillColor(C['gold']);c.rect(0,785,612,7,fill=1,stroke=0);c.rect(0,0,612,5,fill=1,stroke=0)
for yy in range(125,280,42):
 for xx in range(8,620,56):
  c.setFillColor(HexColor('#0e1926'));c.circle(xx+(28 if yy%2 else 0),792-yy,18,fill=1,stroke=0)
c.drawImage(str(ROOT/'Assets/AE_Bridge.png'),231,435,150,150,mask='auto',preserveAspectRatio=True)
text(133,372,'AE BRIDGE',54,'text',True)
c.setStrokeColor(C['gold']);c.line(230,344,382,344)
text(227,460,'PANEL  |  USER GUIDE',12,'muted')
text(187,487,'For Avid Media Composer & After Effects',10,'dim')
text(217,530,'PRAGMATIC FOX  /  2026',9,'gold',True)
text(166,700,'Send plates. Build the comp. Bring it back.',11,'muted')
text(172,744,'Current-source edition  |  20 October 2026',9,'dim')
c.bookmarkPage('p1');c.addOutlineEntry('AE Bridge User Guide','p1');c.showPage()

page(2,'User guide','Contents','A practical guide to setting up AE Bridge and completing your first round-trip.')
entries=[('Install and connect',3),('Your first round-trip',4),('Understand the panel',5),('Build a layered shot',6),('Process a marked range',7),('Settings and naming',8),('Work and render in After Effects',9),('Import renders and versions',10),('Files and cleanup',11),('Troubleshooting',12)]
y=158
for title,n in entries:
 text(70,y,title,12,'text',True);text(530,y,str(n),11,'muted')
 c.linkRect('',f'p{n}',(54,792-y-26,558,792-y+3),relative=0,thickness=0)
 y+=44
note('About this edition','Documents the current local panel and helper source (package 0.0.6), including layered plates, range analysis and licensing controls. Installed beta builds may differ. This is a source-verified guide, not a certification of a released installer.')
end()

page(3,'Getting started','Install and connect','Install the panel and local helper on the Mac where you use Media Composer and After Effects.')
heading('Before you begin')
row('Required environment','The current panel identifies <b>Media Composer 2025.12.1 or later</b> as the full-support baseline. Install Adobe After Effects in the standard Applications location. Use a Mac and a writable working location with space for exported plates and renders.')
heading('How to use')
step(1,'Run the AE Bridge installer','Open the supplied disk image and launch its installer. Fully quit Media Composer when prompted; closing a project alone is not enough. The installer adds the Avid panel and background helper. Enter an administrator password when requested for panel installation.')
step(2,'Open the panel in Avid','Launch Media Composer, open your project and sequence, then choose <b>Tools &gt; AEBridge</b>. Use the installed panel for actual timeline access; a normal browser window cannot read your Avid sequence.')
step(3,'Check the connection','Review the status pill at the top. If it reports a problem, click it and review Diagnostics. Keep the AE Bridge helper running; After Effects must be detected before you can complete a send.')
step(4,'Activate when required','Click <b>Activate / License</b>. In builds with licensing enabled, enter your activation code and click <b>Activate</b>. The same screen offers <b>Refresh license</b> and <b>Deactivate this Mac</b>. Availability depends on the build and your account access.')
note('Permissions','If macOS requests permission for AE Bridge to control After Effects, allow it for this workflow. If denied, review System Settings > Privacy & Security > Automation and retry. Follow any file-access prompts for your working folders.')
end()

page(4,'Getting started','Your first round-trip','Start with one straightforward picture clip before moving on to layered shots or a batch.')
heading('How to use')
step(1,'Park on the shot','Load the sequence into the record monitor and park inside the picture clip you want to send. Confirm its name, timecode, dimensions and frame rate in <b>Current shot</b>. A useful marker comment on the picture track can supply the shot name.')
step(2,'Check Settings','Expand <b>Settings</b>. Choose the QuickTime export setting and handle count. For a first test, use <b>New project per shot</b> and the default project location. Handles default to 8 frames per end.')
step(3,'Analyze and grab','Click <b>Analyze stack</b>. For a single plate, enable only the requested video track in Avid, then click <b>Grab V1</b> (or the track shown). Wait for the grabbed checkmark. Selection of a track header and enabling it for export are different states.')
step(4,'Send to After Effects','Click <b>Send 1 plate to After Effects</b>. Allow Avid to finish its export. AE Bridge opens After Effects with a new composition containing the plate and prepares a render-queue item.')
step(5,'Make your change and render','Edit the composition, save the project, and check the queued output format and destination. Render a QuickTime movie into the prepared watched folder. Keep the comp dimensions, frame rate and full handled duration unchanged.')
step(6,'Import and cut it in','Return to the panel. When the shot offers <b>Import</b>, click it. Review the imported clip in the original export bin, then cut it into the sequence yourself and verify timing and handles.')
note('Keep control of your edit','AE Bridge returns media to a bin. It does not automatically replace the original shot in the record sequence.')
end()

page(5,'Panel reference','Understand the panel','The panel follows the working order: read the shot, prepare plates, send, then import the render.')
heading('Main controls')
for a,b in [
('Status and Activate / License','The status pill summarizes Avid, helper and After Effects availability. The license link opens this Mac\'s activation screen.'),
('Current shot','Shows the record-side sequence readout and playhead timecode. It updates automatically unless you enable Pause updates in Diagnostics; Refresh appears while paused.'),
('Plate stack','Analyze stack finds picture clips under the playhead. Analyze range builds a shot plan across IN/OUT marks. Each plate has its own grab pass; completed plates display a checkmark.'),
('Renaming and Send','Name prefix and Name suffix affect exported names. The Send button reports how many plates have been grabbed for the shot.'),
('Settings','Stores the handle count, QuickTime export setting and project mode. The Template selector appears only when additional templates are available.'),
('Shots','Combines jobs and render files into shot groups. Expand the caret to see multiple render versions. Rescan renders refreshes available files.'),
('Diagnostics','Contains the UI build stamp, log, Copy and Clear, Pause updates, and scratch selection controls. Use Copy when reporting a problem.')]:row(a,b)
note('Start manually','Auto-grab starts off each time the panel opens. Review the plate plan before enabling it.')
end()

page(6,'Avid to After Effects','Build a layered shot','Preserve separate source plates from stacked video tracks instead of sending one flattened picture.')
heading('How to use')
step(1,'Set the analysis scope','Park on the shot and click <b>Analyze stack</b>. By default, analysis considers picture-bearing video tracks. To narrow it, select <b>two or more</b> video track headers first; a single selected header does not restrict the scan.')
step(2,'Review the stack','Confirm the clips and record ranges listed for each track. The lowest analyzed video track is the <b>anchor</b>: it establishes the shot identity and base plate. This is usually V1, but it can be a higher track in a selected subset.')
step(3,'Enable only the requested track','In Avid, isolate the video track named by the next Grab button. Turn off other video tracks for that pass. Click <b>Grab Vn</b>. AE Bridge refuses a grab that would flatten multiple enabled video tracks.')
step(4,'Repeat for the upper plates','Work through the requested tracks in order. If preferred, enable <b>Auto-grab</b> after reviewing the plan: the panel grabs the next plate when it detects that track alone enabled. Wait for each grab to finish before changing tracks.')
step(5,'Send the complete stack','Once all intended plates are grabbed, click <b>Send N plates to After Effects</b>. The comp receives separate footage layers in track order, with the base underneath and upper plates above it. Relative plate offsets are carried into the comp.')
note('Re-grab and Reset stack','Use Re-grab to discard one prepared plate and capture it again. Use Reset stack to forget the current plan and all its grabs, then analyze afresh. These controls do not delete your source media.')
note('Check the composite','Review every imported layer in After Effects. This workflow transfers exported plates and timing; rebuild the creative composite as needed rather than assuming Avid effects have been translated.',True)
end()

page(7,'Avid to After Effects','Process a marked range','Prepare several shots with one track-isolation pass per video track across the range.')
heading('How to use')
step(1,'Mark the range in Avid','Set sequence IN and OUT around the shots you want. Select two or more video track headers if you want to analyze a subset. The lowest analyzed track becomes the anchor.')
step(2,'Click Analyze range','Review the returned shot count, timecodes and plate tracks. The anchor track\'s edit boundaries define shots. Markers supply labels; placing a marker within a clip does not split it into another shot.')
step(3,'Grab the first track across all shots','Enable only the requested video track, then click <b>Grab Vn for all shots</b>. The panel prepares that track for each applicable shot in the plan, so you do not need to change track isolation for every shot.')
step(4,'Repeat for the remaining tracks','When the pass completes, isolate the next requested track and grab again. Optional range <b>Auto-grab</b> starts the pass when the panel sees the requested track alone enabled. Review the track indicators as they complete.')
step(5,'Send the ready shots','When all intended plates are prepared, click <b>Send N shots</b>. Each shot becomes its own job. Let the exports and project preparation finish, then review the resulting compositions in After Effects.')
note('Example','For six shots using V1 and V2, grab V1 across the six shots, then grab V2 across the six shots. The result is six shot jobs, each with separate base and upper plates.')
note('Define new shots with edits','To split a long anchor clip into separate shots, add the required edit in Avid and analyze the range again. Recheck the range plan after changing sequence cuts or track scope.')
end()

page(8,'Preferences','Settings and naming','Set the export and project defaults before grabbing plates for a new shot or range.')
heading('Settings')
row('Handles','The default is <b>8 frames</b> at each end; the input accepts 0-120. Available source media limits the actual handles. If extension is unavailable, the tool may use a shorter extension or the exact clip. Check the actual exported duration before cutting back.')
row('Export setting (QuickTime)','Choose an appropriate saved Avid QuickTime export preset. The default/current option uses Avid\'s current setting. Use a preset that preserves the intended dimensions and frame rate; check a first export before a large batch.')
row('New project per shot','Creates a separate After Effects project for each shot. Use <b>Name / place new project...</b> to choose a location, or leave the project location automatic.')
row('Add to a project...','Choose an existing <b>.aep</b> using <b>Choose .aep...</b>. AE Bridge opens that project and adds a composition. Save other work in After Effects before sending, because the operation may open or create a project.')
heading('Naming')
row('Markers and plate names','The anchor track\'s marker names the shot when available; clip/sequence names provide fallbacks. The anchor plate uses a <b>_pl01</b> suffix. An upper plate uses its own marker label when present, otherwise an automatic plate name.')
row('Name prefix / Name suffix','Adds text around exported plate and shot filenames. Avid subclips keep their marker-derived names. Review the name preview and use a consistent shot naming scheme before sending.')
note('Example','With prefix TEMP_ and suffix _test, the exported name is formed as TEMP_&lt;shot&gt;_test. This changes exported naming, not the source clip\'s name in Avid.')
end()

page(9,'After Effects','Work and render','AE Bridge prepares the project and queue; you make the creative changes and start the render.')
heading('How to use')
step(1,'Inspect the new composition','Check its dimensions, frame rate and duration against the exported base plate. Confirm all expected layers are present and aligned. The base layer name begins with <b>PLATE -</b>. A missing-plate warning or placeholder means you must resolve the import before proceeding.')
step(2,'Build your temp','Add titles, graphics or comp work. Review upper-plate timing and edges. Save the project. The comp is based on exported footage; Avid\'s editable effect parameters are not recreated as native After Effects effects.')
step(3,'Check the Render Queue','AE Bridge normally adds a queue item and sets its output path to the job\'s watched render folder. If the queue item is missing, add the intended comp and point it at that same folder.')
step(4,'Verify output settings','Use an Avid-compatible QuickTime movie output module. Check that the filename extension matches the actual format. Preserve comp resolution, frame rate and the complete handled duration; the tool sets a path but does not guarantee your preferred codec or output-module preset.')
step(5,'Render and wait for completion','Start the render in After Effects. The helper watches for the completed movie. Return to the Shots section once writing is finished; use <b>Rescan renders</b> if the new file has not appeared.')
note('More versions','Render later versions into the same job folder with distinct filenames, such as shot_v002.mov and shot_v003.mov. Keep the technical format and duration consistent so each version can be checked and imported.')
note('Protect the return path','Moving output to an unrelated folder prevents automatic discovery. Do not rename or remove exported plate files while an After Effects project still depends on them.',True)
end()

page(10,'After Effects to Avid','Import renders and versions','Return the completed movie to Avid, then place it into the cut with an editorial check.')
heading('How to use')
step(1,'Review the shot status','<b>in After Effects</b> indicates the shot is waiting for a return. <b>rendering...</b> indicates a file is still being written. <b>Import</b> becomes available for a completed return, and <b>in bin</b> marks an imported render.')
step(2,'Choose a version','For multiple renders, open the shot\'s disclosure caret. Click <b>Import</b> beside the version you want. <b>Import all N</b> imports the shot\'s pending versions when that control is available.')
step(3,'Allow return validation','For matched jobs, AE Bridge checks the return before import, including resolution, frame rate and frame count when available. A validation error needs investigation in the render settings or output; review Diagnostics rather than assuming a failed return is ready to cut.')
step(4,'Find the imported clip','The panel imports through Media Composer into the bin recorded for the export. Keep the relevant project and bin available. Imported state is tracked so already imported versions are distinguished from pending ones.')
step(5,'Cut it into the sequence','Review the render in the source monitor and identify the intended cut range within any handles. Edit it into the sequence manually. Compare timing, composition and head/tail frames against the original shot before moving on.')
note('Do not rely on a filename alone','Check the imported clip\'s actual image and duration. A version name is a convenience, not proof of correct timing or content.')
note('No automatic replacement','The original record sequence is not swapped to the returned movie automatically. Keep the original plate available for further trimming or reworking.')
end()

page(11,'Project housekeeping','Files and cleanup','Keep the exported plates, projects and watched render folders together while a shot remains active.')
heading('Default working locations')
row('Desktop / AEBridge / plates','Exported source movies in job-specific folders. After Effects links to these files; moving or deleting them can make the project offline.')
row('Desktop / AEBridge / render','Watched return folders. Save additional render versions inside the appropriate job folder so they can be discovered.')
row('Desktop / AEBridge / edl','Temporary EDL exports used to analyze picture tracks and shot ranges. Facility-configured locations may differ from these defaults.')
row('After Effects projects','Automatic project work is stored under your user Library / Application Support / AEBridge / aep_work. A project location chosen in Settings takes precedence. Keep a saved project and its required footage for future revisions.')
heading('Panel and Avid cleanup')
row('AEBridge_Temps and AEBridge_Scratch','AEBridge_Temps is the default working/destination bin. Scratch subclips are held in AEBridge_Scratch. In Diagnostics, <b>Select scratch</b> selects them for review; <b>Auto-select on Send</b> can do this after a send. You decide what to delete in Avid.')
row('Clear finished / Reset','Clear finished removes completed jobs from the list. Header Reset asks to drop all job records, including unfinished jobs. Files on disk remain, and already imported renders keep their imported state. Reset stack affects only the current plate plan and grabs.')
note('Before archiving','Collect the After Effects project and all referenced plates along with the approved renders. Panel cleanup is not a media archive or a disk cleanup command. Avoid deleting active plates merely to shorten the Shots list.',True)
end()

page(12,'Support','Troubleshooting','Start with the connection status and Diagnostics. Keep the first test small and repeatable.')
heading('Common issues')
for a,b in [
('Panel is missing from the Tools menu','Fully quit Media Composer and reopen it after installation. Confirm you installed the panel on this Mac. If it is still absent, rerun the supplied installer or ask your facility administrator.'),
('Status reports a helper or After Effects problem','Launch or restart AEBridge Helper from your user Applications folder. Confirm After Effects is installed under Applications. Reopen the panel and review the status details.'),
('Media Composer 2025.12.1+ required','The current panel does not report full support for older hosts or an unrecognized version. Use a supported host and include the detected Avid version when reporting a problem.'),
('The grab is refused or the wrong plates are listed','Enable only the requested video track for export. Two or more selected track headers narrow analysis; one does not. Use Reset stack, park on the intended clip and analyze again if the plan is stale.'),
('After Effects shows a placeholder or missing plate','Check the Avid export completed and that the exported movie exists and opens. Review the missing-file message and Diagnostics. Resolve the source issue and re-grab/re-send as needed.'),
('Render is missing or import validation fails','Wait until rendering finishes, confirm the output is a QuickTime movie in the prepared folder, and click Rescan renders. For validation errors, compare dimensions, frame rate and full handled duration. Restart an older helper if prompted.'),
('Activation or operations are blocked','Open Activate / License and review the access state. Activate with your code or use Refresh license as appropriate. A local edit workflow still needs valid access in builds with licensing enforced.')]: row(a,b)
note('When reporting a problem','Use Diagnostics > Copy. Include the UI build stamp, Avid and After Effects versions, the action that failed, and the exact error. Review the log before sharing because it may contain project names and local paths.')
end()
c.save()
print(OUT)
