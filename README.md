# DASS-Demo

## OS and software preparation

We base our experiment environment on Ubuntu 24.04 LTS and highly recommend that you do the same. This streamlines the setup process and avoids unexpected issues cause by incompatible software versions etc. Please make sure that you have Python installed. Also make sure that you have root or sudo permission.


## Install Nginx and FFmpeg

1. Update and install libs.

'''shell
sudo apt update
sudo apt upgrade -y 

sudo apt install -y build-essential libpcre3 libpcre3-dev libssl-dev zlib1g zlib1g-dev unzip
'''

2. Change the current directory and use sudo access.

'''shell
cd /usr/local/src 
su 
'''

3. Download nginx-rtmp module and all dependencies for nginx-1.27.4

'''shell
wget https://nginx.org/download/nginx-1.27.4.tar.gz  
wget https://github.com/arut/nginx-rtmp-module/archive/master.zip
'''

4. Unzip downloaded files

'''shell
tar -zxvf nginx-1.27.4.tar.gz 
unzip master.zip
'''

5. Compile nginx with rtmp module

'''shell
cd nginx-1.27.4 

./configure --add-module=../nginx-rtmp-module-master --with-http_ssl_module 

make 
make install
'''

6. Make directory for streaming

'''shell
mkdir -p /usr/local/nginx/html/stream/hls
'''

7. Modify nginx.conf

Find IP address of nginx server and use it as the 'server_name' in the 'nginx.conf' file.

8. Install FFmpeg

We used ffmpeg version 6.1.1. and highly recommend that you do the same.

'''shell
sudo apt update
sudo apt install ffmpeg
'''



## Install DASS-Demo/mediaServer


## Install DASS-Demo/surveillanceServer


## Setting DASS-Demo environment


## Running DASS-Demo


## Contact
This page and files are still updating.

Jihoon Lee, Korea University, 

Goeun Park, Korea University, gopark@korea.ac.kr

