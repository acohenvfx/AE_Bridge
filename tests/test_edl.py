"""Regression coverage for the EDL data needed by multi-track planning."""

from service.edl import parse_edl
from service.models import EdlClip, ParseEdlResponse


def test_multi_track_labels_survive_the_helper_contract():
    text = """TITLE: STACK_TEST
001  AX  V   C  01:00:00:00 01:00:01:00 01:00:00:00 01:00:01:00
* FROM CLIP NAME: BASE
002  AX  V2  C  01:00:00:00 01:00:01:00 01:00:00:00 01:00:01:00
* FROM CLIP NAME: TOP
"""
    events = parse_edl(text)
    response = ParseEdlResponse(
        clips=[
            EdlClip(
                num=e.num,
                track=e.track,
                clip_name=e.clip_name,
                rec_in=e.rec_in,
                rec_out=e.rec_out,
                src_in=e.src_in,
                src_out=e.src_out,
            )
            for e in events
        ]
    )

    assert [clip.track for clip in response.clips] == ["V", "V2"]
    assert [clip.clip_name for clip in response.clips] == ["BASE", "TOP"]


def test_3d_warp_key_event_resolves_to_the_real_source_clip():
    """Captured from Media Composer's VFX toolkit EDL preset.

    3D Warp is emitted as a black backing row plus a key-source row carrying
    an extra `000` field and `KEY CLIP NAME`, rather than a normal C event.
    """
    text = """TITLE: Full_sequence_new
FCM: NON-DROP FRAME
000001  BL                               V     K B      00:00:00:00 00:01:01:18 01:01:38:04 01:02:39:22
000001  NBA_BTS_EDIT_V025_LICENSED.MP4   V     K    000 00:00:00:00 00:01:01:18 01:01:38:04 01:02:39:22
*KEY CLIP NAME:  NBA_BTS_EDIT_V025_LICENSED
*SOURCE FILE: (NULL)
"""
    events = parse_edl(text)

    assert len(events) == 1
    assert events[0].num == "000001"
    assert events[0].reel == "NBA_BTS_EDIT_V025_LICENSED.MP4"
    assert events[0].track == "V"
    assert events[0].clip_name == "NBA_BTS_EDIT_V025_LICENSED"
    assert events[0].rec_in == "01:01:38:04"
    assert events[0].rec_out == "01:02:39:22"


if __name__ == "__main__":
    test_multi_track_labels_survive_the_helper_contract()
    test_3d_warp_key_event_resolves_to_the_real_source_clip()
    print("EDL CONTRACT TESTS PASSED")
