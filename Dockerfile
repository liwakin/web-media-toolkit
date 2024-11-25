


FROM emscripten/emsdk

RUN sed -i 's|http://archive.ubuntu.com/ubuntu/|https://mirrors.tuna.tsinghua.edu.cn/ubuntu/|g' /etc/apt/sources.list

ARG FFMPEG_VERSION="5.1.6"
ARG FFMPEG="ffmpeg"

ENV PREFIX=/opt
ENV CFLAGS="-I${PREFIX}/include"
ENV CXXFLAGS="${CFLAGS}"
ENV LDFLAGS="${CFLAGS} -L${PREFIX}/lib"

ENV EM_PKG_CONFIG_PATH=${PREFIX}/lib/pkgconfig:/emsdk/upstream/emscripten/system/lib/pkgconfig
ENV EM_TOOLCHAIN_FILE=${EMSDK}/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake
ENV PKG_CONFIG_PATH=$EM_PKG_CONFIG_PATH

RUN apt-get update && \
    apt-get install -y \
    autoconf \
    automake \
    build-essential \
    libfreetype6-dev \
    libmp3lame-dev \
    libnuma-dev \
    libtool \
    nasm \
    yasm \
    pkg-config \
    texinfo \
    wget \
    zlib1g-dev  \
    libx264-dev

RUN wget https://code.videolan.org/videolan/x264/-/archive/stable/x264-stable.tar.bz2 && \
    tar xjf x264-stable.tar.bz2 
COPY ./scripts/build-x264.sh ./x264-stable/build-x264.sh
RUN cd ./x264-stable && bash -x ./build-x264.sh && cd .. && rm -rf x264-stable x264-stable.tar.bz2

ARG FFMPEG_PACKAGE="ffmpeg-${FFMPEG_VERSION}.tar.bz2"
RUN mkdir -p ${FFMPEG} 
RUN wget https://ffmpeg.org/releases/${FFMPEG_PACKAGE}&& \
    tar xjf ${FFMPEG_PACKAGE} -C ${FFMPEG} --strip-components=1 && \
    rm ${FFMPEG_PACKAGE}

COPY ./scripts/build-ffmpeg.sh ${FFMPEG}/build-ffmpeg.sh
RUN cd ${FFMPEG} && bash -x ./build-ffmpeg.sh

COPY './ffmpeg' ${FFMPEG}

RUN cd ./${FFMPEG} \
    && emcc \
    # --bind \
    -O3 \   
    -I. \  
    -I${PREFIX}/include \
    -L${PREFIX}/lib \
    # -s ASSERTIONS=1 \
    # -s SYSCALL_DEBUG=1 \
    # -s NO_EXIT_RUNTIME=1 \
    -s WASM=1 \ 
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME=ffmpeg \
    -s INITIAL_MEMORY=16MB \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s STACK_SIZE=2MB \  
    -s STACK_OVERFLOW_CHECK=2 \
    -s PTHREAD_POOL_SIZE_STRICT=2 \
    -s FORCE_FILESYSTEM=1 \
    -s WASM_BIGINT \
    -s EXPORTED_FUNCTIONS="['_main']" \
    -s EXPORTED_RUNTIME_METHODS="['FS', 'callMain']" \
    -lworkerfs.js \
    -s USE_PTHREADS=0 \
    -s ENVIRONMENT=web,webview,worker \
    -o ffmpeg.js \
    \
    -lavcodec -lavformat -lavfilter -lx264 -lavutil -lswscale -lm -lavdevice -lswresample -lpostproc \
    ./main.c \
    ./fftools/ffmpeg.c \
    ./fftools/ffprobe.c \
    ./fftools/cmdutils.c \
    ./fftools/ffmpeg_filter.c \
    ./fftools/ffmpeg_hw.c \
    ./fftools/ffmpeg_opt.c \
    ./fftools/opt_common.c \
    ./fftools/ffmpeg_mux.c \
    # ffmpeg v6
    # ./fftools/ffmpeg_demux.c \
    # ./fftools/ffmpeg_mux_init.c \
    # ./fftools/objpool.c \
    # ./fftools/thread_queue.c \
    # ./fftools/sync_queue.c \
    # ./fftools/ffmpeg_dec.c \
    # ./fftools/ffmpeg_enc.c\
    $@ 
