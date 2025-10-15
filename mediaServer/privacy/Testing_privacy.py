#Testing_privacy.py

from raPreprocessor_privacy import SemantPreprocessor
from raEncoder_privacy import SemantEncoder

START_FRAME = 6000
END_FRAME   = 7020
fps = 30
max_chunk_duration = 1
semantic_fname = "output.csv"

# 경로
input_dir_pre = "./input"
output_dir_pre_clear   = "./output/frames_clear"
output_dir_pre_privacy = "./output/frames_privacy"
input_dir_encode_clear   = output_dir_pre_clear
input_dir_encode_privacy = output_dir_pre_privacy
output_dir_temp_clear   = "./output/temp_clear"
output_dir_temp_privacy = "./output/temp_privacy"
output_dir_main = "/usr/local/nginx/html/stream/hls"

print("[▶] Preprocessing CLEAR...")
pre_clear = SemantPreprocessor(
    input_dir_pre, output_dir_pre_clear, fps, max_chunk_duration, semantic_fname,
    frame_dir_name="frame" 
)
pre_clear.folder_init()
names_clear, _ = pre_clear.preProcessing_all(start_frame=START_FRAME, end_frame=END_FRAME, privacy=False)

print("[▶] Preprocessing PRIVACY...")
PRIVACY_FRAME_DIR = "frame_blur"     # 여기만 바꾸면 됨: "frame_blur" 또는 "frame_faceswap"
pre_priv = SemantPreprocessor(
    input_dir_pre, output_dir_pre_privacy, fps, max_chunk_duration, semantic_fname,
    frame_dir_name=PRIVACY_FRAME_DIR
)
pre_priv.folder_init()
names_priv, _ = pre_priv.preProcessing_all(start_frame=START_FRAME, end_frame=END_FRAME, privacy=True)

print("[▶] Encoding CLEAR (init & master create)...")
enc_clear = SemantEncoder(input_dir_encode_clear, output_dir_temp_clear, output_dir_main, fps)
enc_clear.encoding(list(names_clear), init_output=True)   # master.m3u8에 clear+privacy 둘 다 등록

print("[▶] Encoding PRIVACY (append only)...")
enc_priv = SemantEncoder(input_dir_encode_privacy, output_dir_temp_privacy, output_dir_main, fps)
enc_priv.encoding(list(names_priv), init_output=False)    # 이미 만든 *_privacy.m3u8에 이어붙임

print("[✔] Done. Both clear and privacy variants generated.")
