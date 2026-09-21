#!/usr/bin/env bash
# Turn the downloaded CC0 chiptunes into small, seamlessly-looping background
# music, one per time of day. Tooling only — it trims and re-encodes the
# tracks, it does not author any music.
#
#   FFMPEG=/path/to/ffmpeg bash scripts/build-music.sh
#
# Medieval theme only. Sources live in art-src/medieval/audio-src/ (originals,
# not shipped); output goes to public/assets/themes/medieval/audio/. Provenance
# is in src/data/attributions.js. (Neon City's music is composed, not
# downloaded: see scripts/compose-neon-music.py.)
#
# No ffmpeg on PATH? `pip install imageio-ffmpeg` ships one:
#   FFMPEG="$(python -c 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())')"
#
# Two modes, because the sources differ:
#
#   whole  The track is already one loop. Use all of it and only taper the
#          first/last 60 ms, which kills the click at the seam without a dip.
#
#   wrap   The track is a long piece that was never meant to loop. Cut a
#          section and build it as  [head*fade-in + tail*fade-out] ++ body,
#          so the file already ends with the material that leads back into
#          its own start — on repeat it joins instead of restarting.
#
# Everything is re-encoded to 96 kbps stereo and loudness-matched, so the
# four sit at the same level and the whole set is a few MB rather than ~30.
set -euo pipefail

FF="${FFMPEG:-ffmpeg}"
FP="${FFPROBE:-ffprobe}"
SRC="art-src/medieval/audio-src"
OUT="public/assets/themes/medieval/audio"
mkdir -p "$OUT"

XF=6          # seconds of tail wrapped back over the head, in `wrap` mode
EDGE=0.06     # seconds of taper at each end, in `whole` mode
LUFS=-23      # quiet: this plays under everything else
BITRATE=96k

enc() { "$FF" -v error -y "$@" -c:a libmp3lame -b:a "$BITRATE" -ac 2 -write_xing 1 \
          -metadata comment="CC0 - see src/data/attributions.js"; }

# name  mode   src-ext  start  length
TRACKS=(
  "dawn   whole  ogg  0   0"
  "day    wrap   ogg  8   90"
  "dusk   whole  mp3  0   0"
  "night  whole  ogg  0   0"
)

for row in "${TRACKS[@]}"; do
  read -r name mode ext start len <<<"$row"
  src="$SRC/$name.$ext"
  dst="$OUT/$name.mp3"

  if [ "$mode" = whole ]; then
    secs=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$src")
    out_st=$(python3 -c "print(max(0.0, $secs - $EDGE))")
    echo "--- $name  (whole, ${secs}s) ---"
    enc -i "$src" -af "afade=t=in:st=0:d=${EDGE},afade=t=out:st=${out_st}:d=${EDGE},loudnorm=I=${LUFS}:TP=-2:LRA=11,aresample=44100" "$dst"
  else
    echo "--- $name  (wrap, from ${start}s, ${len}s loop) ---"
    enc -i "$src" -filter_complex "
      [0:a]atrim=start=${start}:duration=${len},asetpts=N/SR/TB,asplit=2[a1][a2];
      [a1]atrim=0:${XF},asetpts=N/SR/TB,afade=t=in:st=0:d=${XF}[head];
      [a2]atrim=start=${XF},asetpts=N/SR/TB[body];
      [0:a]atrim=start=$((start+len)):duration=${XF},asetpts=N/SR/TB,afade=t=out:st=0:d=${XF}[tail];
      [head][tail]amix=inputs=2:normalize=0[joined];
      [joined][body]concat=n=2:v=0:a=1,loudnorm=I=${LUFS}:TP=-2:LRA=11,aresample=44100[out]" \
      -map "[out]" "$dst"
  fi
  printf "    %.1fs  %.2f MB\n" \
    "$("$FP" -v error -show_entries format=duration -of csv=p=0 "$dst")" \
    "$(python3 -c "import os; print(os.path.getsize('$dst') / 1048576)")"
done

echo "--- total ---"
du -ch "$OUT"/*.mp3 | tail -1
