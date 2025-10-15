# Testing.py

from raPreprocessor import SemantPreprocessor
from raEncoder import SemantEncoder
from semanticEncoder import semanticEncoder
import numpy as np

# ------------------------------------------------
# 실행할 프레임 범위
#START_FRAME = 0
#END_FRAME = 1020
#START_FRAME = 7000
#END_FRAME = 8020
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
    
    # 상단에 설정된 START_FRAME과 END_FRAME 변수를 사용
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
    
    encoder.encoding(folder_names)
    
    print("[✔] Encoding Test Finished.")


## 옵션 3: 전체 파이프라인(Semantic Encoder) 테스트
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
    
    # 상단에 설정된 START_FRAME과 END_FRAME 변수를 사용
    s_encoder.encoding_all(enable_pre=True, start_frame=START_FRAME, end_frame=END_FRAME)
    
    print("[✔] Full Semantic Encoder Pipeline Finished.")