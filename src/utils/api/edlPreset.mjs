// Bundled List Tool setting, copied from the working VFX toolkit edl preset.
// Only the setting name differs; no user profile or filesystem paths are included.
// LoadSetting creates a read-only, non-persistent setting (MC 2023.12+).
export const EDL_PRESET_NAME = 'Pragmatic Fox - AE Bridge EDL'
export const EDL_PRESET_ID = 'com.acohenvfx.aebridge.edl.v1'
export const EDL_PRESET_XML = String.raw`<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<!DOCTYPE Avid:StreamItems SYSTEM "AvidSettingsFile.dtd">
<Avid:StreamItems xmlns:Avid="http://www.avid.com">
  <Avid:XMLFileData>
<AvProp name="DomainMagic" type="string">Domain</AvProp>
    <AvProp name="DomainKey" type="char4">1480739396x</AvProp>
    <AvClass id="SETG" />
    <AvClass id="LTSG">
      <AvProp id="ASET" name="name" type="string">Pragmatic Fox - AE Bridge EDL</AvProp>
      <AvProp id="ASET" name="kind" type="string">ListToolSettings</AvProp>
      <AvProp id="ASET" name="attributes" type="int16">144</AvProp>
      <AvProp id="ASET" name="type" type="int16">20</AvProp>
      <AvProp id="ASET" name="attrList" type="reference">
        <AvClass id="ATTR">
          <AvProp id="ATTR" name="__OMFI:ATTR:NumItems" type="int32">122</AvProp>
          <List id="OMFI:ATTR:AttrRefs">
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">IncInList_ListType_0</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">29</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">29 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 1 1 1 1 0 0 0 0 1 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_0SelColumnCount</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">8</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_0SelectedColumns</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">32</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">32 1e 0 0 0 1c 0 0 0 1d 0 0 0 11 0 0 0 c 0 0 0 9 0 0 0 6e 0 0 0 22 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_lfoa</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_head</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">10</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">10 0 0 30 30 30 30 2b 30 30 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_tail</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">10</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">10 0 0 30 30 30 30 2b 30 30 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_markShortCuts</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_markJumpCuts</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_markShortCutsVal</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_markJumpCutsVal</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_showDupeRefs</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_incPullList</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 1 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_firstsort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_secondSort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_thirdSort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_order</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_separators</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_incLeader</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">AsOpt_m_incOpt</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 1 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">IncInList_ListType_1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">29</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">29 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 1 1 1 1 0 0 0 0 1 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_1SelColumnCount</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">8</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_1SelectedColumns</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">32</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">32 1e 0 0 0 1c 0 0 0 1d 0 0 0 11 0 0 0 c 0 0 0 9 0 0 0 6e 0 0 0 22 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OpOpt_m_firstsort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OpOpt_m_secondSort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OpOpt_m_thirdSort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OpOpt_m_order</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OpOpt_m_separators</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OpOpt_m_incLeader</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OpOpt_m_incOpt</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OpOpt_m_keyFrames</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OpOpt_m_opticalFootage</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OpOpt_m_pageBreak</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">IncInList_ListType_2</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">29</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">29 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 1 1 1 1 0 0 0 0 1 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_2SelColumnCount</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">8</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_2SelectedColumns</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">32</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">32 1e 0 0 0 1c 0 0 0 1d 0 0 0 11 0 0 0 c 0 0 0 9 0 0 0 6e 0 0 0 22 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">DupOpt_assumeHandles</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">3</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">3 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">DupOpt_printHandles</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">3</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">3 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">IncInList_ListType_3</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">29</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">29 1 1 1 1 1 1 0 0 1 1 0 1 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_3SelColumnCount</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">8</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_3SelectedColumns</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">32</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">32 1e 0 0 0 1c 0 0 0 1d 0 0 0 11 0 0 0 c 0 0 0 6e 0 0 0 9 0 0 0 12 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChOpt_m_showOnlyChanges</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChOpt_m_combineDeletions</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChOpt_m_previewCode</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">IncInList_ListType_4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">29</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">29 1 1 1 1 1 1 0 0 1 1 0 1 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_4SelColumnCount</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">8</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_4SelectedColumns</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">32</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">32 1e 0 0 0 1c 0 0 0 1d 0 0 0 11 0 0 0 c 0 0 0 6e 0 0 0 9 0 0 0 12 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChPOpt_m_firstsort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChPOpt_m_secondSort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChPOpt_m_thirdSort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChPOpt_m_order</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChPOpt_m_separators</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChPOpt_m_incLeader</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChPOpt_m_incOpt</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">IncInList_ListType_5</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">29</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">29 1 1 1 1 1 1 0 0 1 1 0 1 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_5SelColumnCount</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">8</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_5SelectedColumns</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">32</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">32 1e 0 0 0 1c 0 0 0 1d 0 0 0 11 0 0 0 c 0 0 0 6e 0 0 0 9 0 0 0 12 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChDisOpt_m_firstsort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChDisOpt_m_secondSort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChDisOpt_m_thirdSort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChDisOpt_m_order</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChDisOpt_m_separators</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChDisOpt_m_incLeader</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChDisOpt_m_incOpt</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">IncInList_ListType_6</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">29</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">29 1 1 1 1 1 1 0 0 1 1 0 1 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_6SelColumnCount</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">8</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_6SelectedColumns</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">32</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">32 1e 0 0 0 1c 0 0 0 1d 0 0 0 11 0 0 0 c 0 0 0 6e 0 0 0 9 0 0 0 12 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChOpOpt_m_keyFrames</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChOpOpt_m_opticalFootage</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ChOpOpt_m_pageBreak</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">1 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">IncInList_ListType_7</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">29</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">29 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 1 1 1 1 0 0 0 0 1 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_7SelColumnCount</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">8</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_7SelectedColumns</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">32</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">32 1e 0 0 0 1c 0 0 0 1d 0 0 0 11 0 0 0 c 0 0 0 9 0 0 0 6e 0 0 0 22 0 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ScanOpt_m_firstsort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ScanOpt_m_secondSort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ScanOpt_m_thitdSort</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ScanOpt_m_order</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ScanOpt_m_separators</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">IncInList_ListType_8</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">29</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">29 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 1 1 1 1 0 0 0 0 1 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_8SelColumnCount</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_8SelectedColumns</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">0</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">IncInList_ListType_9</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">29</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">29 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 1 1 1 1 0 0 0 0 1 0 0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_9SelColumnCount</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">_ListType_9SelectedColumns</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobSize" type="int32">0</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:BobData" type="bytes">0 </AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">optimizeEDL</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">mergeTrackEvents</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">EDLHandles</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">includeSourceTable</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">s3dContr</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">sourceTC</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">recordTC</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">reelIDtype</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">sortMode</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">11</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">pulldownStartingFrame</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">startingTimecodeChoice</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">truncation</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">convertTapeNames</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">startEventNum</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">m_masDurationFormat</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">m_srcDurationFormat</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">m_footageFormat</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">m_masterTCType</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">m_locators</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">mm_displayHandles</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">m_displayHandlesVal</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">m_startAt</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">OutputFormatID</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">5</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">ListType</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">CheckedStateForList_0</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">CheckedStateForList_1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">CheckedStateForList_2</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">CheckedStateForList_7</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">CheckedStateForList_3</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">1</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">CheckedStateForList_4</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">CheckedStateForList_5</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">CheckedStateForList_6</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">Separate_Lists</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">Frame_Images</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">Show_Prefix</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">MatchBack_Info</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">Disable_Perf_Slip</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">Show_Icons</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem>
              <AvProp id="ATTR" name="OMFI:ATTB:Kind" type="int32">1</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:Name" type="string">Ignore_Spec_Char</AvProp>
              <AvProp id="ATTR" name="OMFI:ATTB:IntAttribute" type="int32">0</AvProp>
            </ListElem>
            <ListElem />
          </List>
        </AvClass>
      </AvProp>
    </AvClass>
      </Avid:XMLFileData>
</Avid:StreamItems>
`
