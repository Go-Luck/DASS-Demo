# raPreprocessor.py

import pandas as pd
import os
import shutil
from pathlib import Path
import numpy as np

class SemantPreprocessor ():
    def __init__ (self, input_dir_pre, output_dir_pre, fps, max_chunk_duration, semantic_fname):
        self.input_dir = Path(input_dir_pre)
        self.output_dir = Path(output_dir_pre)
        self.fps = fps
        self.max_duration = max_chunk_duration  
        self.max_images = fps * max_chunk_duration
        self.semantic_fname = semantic_fname
        
    def folder_init (self):
        if self.output_dir.exists():
            print ("Remove folders in output_dir of preprocessing", self.output_dir)
            shutil.rmtree(self.output_dir)
    
    def load_semantic_info (self, semantic_fname = None, start_frame=0, end_frame=None):
        # [수정] end_frame 파라미터 추가
        if semantic_fname is None:
            semantic_fname = self.semantic_fname
        
        semantic_path = self.input_dir / semantic_fname
        semantic_df = pd.read_csv(semantic_path)

        # [수정] start_frame과 end_frame을 사용하여 DataFrame을 슬라이싱
        if end_frame is None:
            end_frame = len(semantic_df) # end_frame이 없으면 끝까지 처리
            
        if start_frame > 0 or end_frame < len(semantic_df):
            print(f"[✔] Processing frames from index {start_frame} to {end_frame}")
            semantic_df = semantic_df.iloc[start_frame:end_frame]
        
        frame_risk_list = list(zip(semantic_df["frame"], semantic_df["risk"], semantic_df["level"]))
        return frame_risk_list
    
    def splitSegemnt(self, filename, risk, level, folder_index, file_index, new_folder = False, privacy = False):
        privacy_tag = "blur" if privacy else "clear"
        folder_name = f"segment_{folder_index:04d}_{privacy_tag}_{risk}_{level}"
        folder_path = self.output_dir / folder_name

        if new_folder:
            folder_path.mkdir(parents=True, exist_ok=True)
        
        src_path = self.input_dir / "frame" / filename
        dst_path = folder_path / f"frame{file_index:04d}.jpg"
        shutil.copyfile(src_path, dst_path)
        
        return folder_name

    def splitSegments_all(self, frame_risk_list, privacy=False):
        folder_index = 0
        folder_names = []
        
        for i in range(0, len(frame_risk_list), self.max_images):
            chunk = frame_risk_list[i : i + self.max_images]
            
            if len(chunk) < self.max_images:
                print(f"[i] Skipping last incomplete chunk with {len(chunk)} frames.")
                continue

            folder_index += 1
            first_frame_filename, first_frame_risk, first_frame_level = chunk[0]
            
            folder_name = self.splitSegemnt(
                first_frame_filename, first_frame_risk, first_frame_level, 
                folder_index, 0, new_folder=True, privacy=privacy
            )
            folder_names.append(folder_name)
            
            for file_index_in_chunk, (filename, _, _) in enumerate(chunk[1:], start=1):
                self.splitSegemnt(
                    filename, first_frame_risk, first_frame_level,
                    folder_index, file_index_in_chunk, new_folder=False, privacy=privacy
                )

        np.save(self.output_dir / 'foldername.npy', np.array(folder_names))
        return folder_names, []

    def preProcessing_all (self, semantic_fname = None, privacy=False, start_frame=0, end_frame=None):
        # [수정] end_frame 파라미터 추가
        if  semantic_fname is None:
            semantic_fname = self.semantic_fname
        
        # [수정] load_semantic_info 호출 시 end_frame 전달
        frame_risk_list = self.load_semantic_info(semantic_fname, start_frame=start_frame, end_frame=end_frame)

        folder_names, images_folder_list = self.splitSegments_all(frame_risk_list, privacy=privacy)
        return folder_names, images_folder_list