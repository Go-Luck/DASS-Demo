# semanticEncoder_sub.py

# 파일명 변경
from raEncoder_sub import * 
import numpy as np

class semanticEncoder ():
    def __init__ (self, input_dir_pre, output_dir_pre, fps, max_chunk_duration, semantic_fname, input_dir_encode, output_dir_encode_temp, output_dir_encode_main):
        self.prepro = SemantPreprocessor(input_dir_pre, output_dir_pre, fps, max_chunk_duration, semantic_fname)
        self.encoder = SemantEncoder(input_dir_encode, output_dir_encode_temp, output_dir_encode_main, fps)
        self.output_dir_pre = output_dir_pre 
        
    def encoding_all (self, enable_pre = True, start_frame=0, end_frame=None):
        folder_names = None
        vtt_cues = None 
        if enable_pre == True:
            folder_names, vtt_cues = self.prepro.preProcessing_all(start_frame=start_frame, end_frame=end_frame)
        else:
            folder_names = np.load( self.output_dir_pre+'/foldername.npy')
            print("[!] Preprocessing skipped. Subtitles will not be generated.")
            vtt_cues = [] 

        if folder_names is not None and len(folder_names) > 0:
            self.encoder.encoding(folder_names, vtt_cues)
        else:
            print("[!] No segments to encode. Please check your frame range and preprocessing results.")
    
    def encoding_realtime(self):
        pass