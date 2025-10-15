# semanticEncoder.py

from raPreprocessor import *
from raEncoder import *
import numpy as np

class semanticEncoder ():
    def __init__ (self, input_dir_pre, output_dir_pre, fps, max_chunk_duration, semantic_fname, input_dir_encode, output_dir_encode_temp, output_dir_encode_main):
        self.prepro = SemantPreprocessor(input_dir_pre, output_dir_pre, fps, max_chunk_duration, semantic_fname)
        self.encoder = SemantEncoder(input_dir_encode, output_dir_encode_temp, output_dir_encode_main, fps)
        self.output_dir_pre = output_dir_pre 
        
    def encoding_all (self, enable_pre = True, start_frame=0, end_frame=None):
        # [수정] end_frame 파라미터 추가
        
        folder_names = None
        if enable_pre == True:
            # [수정] preProcessing_all 호출 시 end_frame 값을 전달
            folder_names, images_folder_list = self.prepro.preProcessing_all(start_frame=start_frame, end_frame=end_frame)
        else:
            folder_names = np.load( self.output_dir_pre+'/foldername.npy')

        if folder_names is not None and len(folder_names) > 0:
            self.encoder.encoding(folder_names)
        else:
            print("[!] No segments to encode. Please check your frame range and preprocessing results.")
    
    def encoding_realtime(self):
        pass