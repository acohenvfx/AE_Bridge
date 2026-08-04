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


if __name__ == "__main__":
    test_multi_track_labels_survive_the_helper_contract()
    print("EDL CONTRACT TESTS PASSED")
