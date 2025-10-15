# Testing_sub.py

from raPreprocessor_sub import SemantPreprocessor # 파일명 변경
from raEncoder_sub import SemantEncoder          # 파일명 변경
from semanticEncoder_sub import semanticEncoder  # 파일명 변경
import numpy as np

# --- 이 부분만 수정하세요 ---
# ------------------------------------------------
# 실행할 프레임 범위
START_FRAME = 6000
END_FRAME = 7020

# 실행할 테스트 옵션 (하나만 True로 설정 권장)
preprocTest = False
encoderTest = False
s_encoderTest = True # <-- 전체 파이프라인 실행
# ------------------------------------------------

## 옵션 1: 전처리(Preprocessing)만 테스트
if preprocTest:
    print("[▶] Running Preprocessing Test...")
    # --- 설정 ---
    input_dir_pre = "./input"
    output_dir_pre = "./output/frames"
    fps = 30
    max_chunk_duration = 1
    semantic_fname = "output.csv"
    
    prepro = SemantPreprocessor(input_dir_pre, output_dir_pre, fps, max_chunk_duration, semantic_fname)
    
    prepro.preProcessing_all(start_frame=START_FRAME, end_frame=END_FRAME)
    
    print("[✔] Preprocessing Test Finished.")


## 옵션 2: 인코딩(Encoding)만 테스트
if encoderTest:
    print("[▶] Running Encoding Test...")
    # --- 설정 ---
    input_dir_encode = "./output/frames"
    output_dir_temp = "./output/temp"
    output_dir_main = "/usr/local/nginx/html/stream/hls"
    franmaes_dir = './output/frames/foldername.npy'
    fps = 30

    encoder = SemantEncoder(input_dir_encode, output_dir_temp, output_dir_main, fps)
    
    folder_names = np.load(franmaes_dir)
    print(f"Loaded {len(folder_names)} segment folders for encoding.")
    
    # Note: This test option will fail because it doesn't generate vtt_cues.
    # It needs to be adapted if you want to run encoding standalone.
    # For now, it's recommended to use the full pipeline test below.
    # encoder.encoding(folder_names) 
    print("[!] Standalone encoder test is not supported with subtitles. Please use the full pipeline test.")
    
    print("[✔] Encoding Test Finished.")


## 옵션 3: 전체 파이프라인(Semantic Encoder) 테스트 (권장)
if s_encoderTest:
    print("[▶] Running Full Semantic Encoder Pipeline Test...")
    # --- 설정 ---
    input_dir_pre = "./input"
    output_dir_pre = "./output/frames"
    semantic_fname = "output.csv"
    input_dir_encode = "./output/frames"
    output_dir_encode_temp = "./output/temp"
    output_dir_encode_main = "/usr/local/nginx/html/stream/hls"
    fps = 30
    max_chunk_duration = 1
    
    s_encoder = semanticEncoder(
        input_dir_pre, output_dir_pre, fps, max_chunk_duration, semantic_fname,
        input_dir_encode, output_dir_encode_temp, output_dir_encode_main
    )
    
    s_encoder.encoding_all(enable_pre=True, start_frame=START_FRAME, end_frame=END_FRAME)
    
    print("[✔] Full Semantic Encoder Pipeline Finished.")