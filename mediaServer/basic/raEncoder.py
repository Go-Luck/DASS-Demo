# raEncoder.py

import subprocess
from pathlib import Path
import shutil
import os


class SemantEncoder ():
    def __init__ (self, input_dir, output_dir_temp, output_dir, fps):
        self.input_dir = input_dir
        self.output_dir_temp = output_dir_temp
        self.output_dir = output_dir
        self.framerate = fps
        
    def folder_init (self, path):
        if os.path.exists(path):
            print ("Remove folders in output folder at ", path)
            shutil.rmtree(path)
        Path(path).mkdir(parents=True, exist_ok=True)

    def add_semantic_tag_to_m3u8(self, m3u8_path, risk_type, risk_leve,bool_privacy = 0):
        with open(m3u8_path, "r") as f:
            lines = f.readlines()

        output_lines = []
        inserted = False
        risk_tag = int(risk_leve)

        for line in lines:
            output_lines.append(line)
            if not inserted and line.startswith("#EXTINF:"):
                output_lines.insert(-1, f"#EXT-X-SEMANTICTYPE:{int(risk_type)}\n")
                output_lines.insert(-1, f"#EXT-X-SEMANTICLEVEL:{risk_tag}\n")
                output_lines.insert(-1, f"#EXT-X-PRIVACY:{int(bool_privacy)}\n")
                inserted = True

        with open(m3u8_path, "w") as f:
            f.writelines(output_lines)
        print(f"[✔] Inserted semantic tag: #EXT-X-SEMANTICTYPE:{risk_type} → {m3u8_path}")
        print(f"[✔] Inserted semantic tag: #EXT-X-SEMANTICLEVEL:{risk_tag} → {m3u8_path}")
        print(f"[✔] Inserted semantic tag: #EXT-X-PRIVACY:{bool_privacy} → {m3u8_path}")

        
    def encode_per_folder(self, input_foler_path,risk_type, risk_level,privacy, index, segment_prefix = "720p", scale = "scale=1280:720", bitrate="2800", start_number=0):
        input_pattern = input_foler_path+"/frame%04d.jpg"
        output_temp_path = self.output_dir_temp+'/temp_'+segment_prefix+'_'+privacy +'_'+str(index) 
        self.folder_init(output_temp_path)
        Path(output_temp_path).mkdir(parents=True, exist_ok=True)

        m3u8_path = output_temp_path+ "/"+ f"{segment_prefix}.m3u8"
        segment_pattern = output_temp_path + "/"+ f"{segment_prefix}_%04d.ts"

        # [수정] 타임스탬프 교정을 위한 비디오 필터 추가
        video_filters = f"{scale},setpts=PTS-STARTPTS"

        # FFmpeg Commend
        cmd = [
            "ffmpeg",
            "-framerate", str(self.framerate),
            "-start_number", str(start_number),
            "-i", input_pattern,
            "-vf", video_filters,  # [수정됨] 타임스탬프 교정 필터 적용
            "-r", str(self.framerate), # [추가됨] 출력 프레임레이트 강제
            "-c:v", "libx264",
            "-b:v", bitrate,
            "-preset", "fast",
            "-g", "30",
            "-keyint_min", "30",
            "-sc_threshold", "0",
            "-force_key_frames", "expr:gte(t,n_forced*1)",
            "-hls_time", "1",
            "-hls_flags", "independent_segments+program_date_time",
            "-hls_playlist_type", "event",
            "-hls_segment_filename", segment_pattern,
            "-f", "hls",
            m3u8_path
        ]
        print(f"[▶] Running FFmpeg : {' '.join(cmd)}")
        subprocess.run(cmd, check=True)
        print(f"[✔] HLS encoded: {m3u8_path}")

        if privacy == 'blur': 
            bool_privacy = 1
        else:
            bool_privacy = 0
        
        self.add_semantic_tag_to_m3u8(m3u8_path, risk_type, risk_level, bool_privacy=bool_privacy )     
        
        return output_temp_path
        
    def create_init_m3u8(self, 
                          playlist_info = [("1080p", "1920x1080", 5000000, False),
                                           ("480p",  "854x480",   1400000, False),
                                           ("144p",  "256x144",   250000,  False)]):
        output_dir = Path(self.output_dir)
        master_path = output_dir / "master.m3u8"

        lines = ["#EXTM3U", "#EXT-X-VERSION:3\n"]

        for filename, resolution, bandwidth, privacy in playlist_info:
            if privacy == True:
                lines.append(f"#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},RESOLUTION={resolution},NAME={filename}_privacy")
                filename = filename+"_privacy.m3u8"
            else:   
                lines.append(f"#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},RESOLUTION={resolution},NAME={filename}")
                filename = filename+".m3u8"
            lines.append(filename)
            
            output_m3u8_path = self.output_dir+"/"+ filename
            with open(output_m3u8_path, "w") as f:
                pass 

        with open(master_path, "w") as f:
            f.write("\n".join(lines) + "\n")

        print(f"[✔] Created master.m3u8 and resoultion.m3u8 files at {master_path}")
        
        
    def update_ts_m3u8(self, temp_folder_path,  file_index, segment_prefix="1080p", privacy = False, next_risk_level=None):
        src =temp_folder_path + "/"+f"{segment_prefix}_0000.ts"
        ts_index = temp_folder_path.split("_")[-1]

        if privacy == True:
            dst = self.output_dir + "/" + f"{segment_prefix}_{int(ts_index):04d}_privacy.ts"
        else:
            dst = self.output_dir + "/" + f"{segment_prefix}_{int(ts_index):04d}.ts"
        shutil.copyfile(src, dst)

        m3u8_path = temp_folder_path+"/"+ f"{segment_prefix}.m3u8"

        if privacy == True:
            output_m3u8_path = self.output_dir+"/"+ f"{segment_prefix}_privacy.m3u8"
        else:
            output_m3u8_path = self.output_dir+"/"+ f"{segment_prefix}.m3u8"
        
        if int(ts_index) == 1:
            shutil.copyfile(m3u8_path, output_m3u8_path)
            with open(output_m3u8_path, "r") as f:
                lines = f.readlines()
            original_name = f"{segment_prefix}_{int(0):04d}.ts"
            if privacy:
                privacy_name = f"{segment_prefix}_{int(ts_index):04d}_privacy.ts"
            else:
                privacy_name = f"{segment_prefix}_{int(ts_index):04d}.ts"

            updated_lines = [
                line.replace(original_name, privacy_name)
                for line in lines
            ]
            
            if next_risk_level is not None:
                for i, line in enumerate(updated_lines):
                    if line.startswith("#EXT-X-SEMANTICLEVEL:"):
                        updated_lines.insert(i + 1, f"#EXT-X-NEXT-SEMANTICLEVEL:{int(next_risk_level)}\n")
                        break
                    
            with open(output_m3u8_path, "w") as f:
                f.writelines(updated_lines)

        else:
            self.append_m3u8_file(m3u8_path, output_m3u8_path,segment_prefix, ts_index, privacy = privacy, next_risk_level=next_risk_level)
    
    def append_m3u8_file(self, m3u8_path, output_m3u8_path, segment_prefix, ts_index, privacy=False, next_risk_level=None):
        output_lines = [] 
        
        with open(m3u8_path, "r") as f:
            lines = f.readlines()

        for i in range(len(lines)):
            if lines[i].startswith("#EXT-X-SEMANTICTYPE"):
                if i + 4 <= len(lines):
                    risk_type_line = '\n' + lines[i].strip() + '\n'
                    risk_level_line = lines[i + 1].strip() + '\n'
                    privacy_line = lines[i + 2].strip() + '\n'
                    extinf_line = lines[i + 3].strip() + '\n'
                    if privacy:
                        ts_line = f"{segment_prefix}_{int(ts_index):04d}_privacy.ts\n"
                    else:
                        ts_line = f"{segment_prefix}_{int(ts_index):04d}.ts\n"

                    output_lines = [risk_type_line, risk_level_line, privacy_line]
                    if next_risk_level is not None:
                        output_lines.append(f"#EXT-X-NEXT-SEMANTICLEVEL:{int(next_risk_level)}\n")
                    output_lines += [extinf_line, ts_line]

        with open(output_m3u8_path, "r") as f:
            existing = f.readlines()
        if existing and existing[-1].strip() == "#EXT-X-ENDLIST":
            existing = existing[:-1]
        with open(output_m3u8_path, "w") as f:
            f.writelines(existing + output_lines)
            f.write("#EXT-X-ENDLIST\n")

        print(f"[✔] Appended {m3u8_path} → {output_m3u8_path} with NEXT-SEMANTICLEVEL:{next_risk_level}")

    def encoding (self, folder_names, 
                  encoding_list = [("1080p","scale=1920:1080", "5000k" ),
                                   ("480p","scale=854:480",   "1400k" ),
                                   ("144p","scale=256:144",   "250k" )]):
        start_number = 1
        
        self.folder_init(self.output_dir_temp)
        self.folder_init(self.output_dir)
        self.create_init_m3u8()

        for i, folder_name in enumerate(folder_names):
            risk_level = folder_name.split("_")[-1]
            risk_type = folder_name.split("_")[-2]
            privacy = folder_name.split("_")[-3]
            file_index =  folder_name.split("_")[-4]
            bool_privacy = False
            if privacy == "blur":
                bool_privacy = True

            next_risk_level = None
            if i + 1 < len(folder_names):
                next_folder = folder_names[i + 1]
                next_risk_level = next_folder.split("_")[-1]

            input_foler_path = self.input_dir + "/" + folder_name

            for segment_prefix, scale, bitrate in encoding_list:
                temp_folder_path = self.encode_per_folder(
                    input_foler_path, risk_type, risk_level, privacy, file_index,
                    segment_prefix=segment_prefix, scale=scale, bitrate=bitrate, start_number=0
                )
                self.update_ts_m3u8(temp_folder_path, file_index, segment_prefix=segment_prefix,
                                    privacy=bool_privacy, next_risk_level=next_risk_level)
        return file_index