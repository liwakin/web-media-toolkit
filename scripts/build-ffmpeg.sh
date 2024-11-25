#!/bin/bash

set -euo pipefail

CONF_FLAGS=(
  --target-os=none 
  --arch=x86_32 
  --prefix=${PREFIX}
  
  --disable-all 
  --disable-debug 
  --disable-asm   
  --disable-x86asm 
  --disable-inline-asm 
  --disable-stripping 
  --disable-programs 
  --disable-doc 
  --disable-autodetect 
  --disable-runtime-cpudetect 
  --disable-pthreads 

  --enable-small
  --enable-cross-compile 
  --enable-gpl 
  --enable-libx264 
  --enable-avcodec 
  --enable-avformat 
  --enable-avfilter 
  --enable-swscale 
  --enable-avutil 
  --enable-avdevice 
  --enable-swresample 
  --enable-postproc 
  --enable-filters

  --enable-decoder=h264 
  --enable-decoder=aac  
  --enable-decoder=mjpeg
  --enable-encoder=mjpeg
  --enable-encoder=h264 

  --enable-parser=h264

  --enable-muxer=image2  
  --enable-muxer=mp4 
  --enable-demuxer=mov
  --enable-demuxer=mp4  
  --enable-demuxer=image2               
  
  --enable-protocol=file

  # assign toolchains and extra flags
  --nm=emnm
  --ar=emar
  --ranlib=emranlib
  --cc=emcc
  --cxx=em++
  --objcc=emcc
  --dep-cc=emcc
  --extra-cflags="${CFLAGS}"
  --extra-cxxflags="${CXXFLAGS}"
)

emconfigure ./configure "${CONF_FLAGS[@]}" $@
emmake make -j$(nproc)
emmake make install

