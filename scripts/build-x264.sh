#!/bin/bash

set -euo pipefail

ARGS=(
  --prefix=${PREFIX}                  # output directory
  --host=x86-gnu                      # use x86-gnu toolchain
  --enable-static                     # enable building static library
  --disable-cli                       # disable cli tools
  --disable-asm                       # disable asm optimization
  --enable-pic
  --extra-cflags="-s USE_PTHREADS=1"  # pass this flags for using pthreads
)

emconfigure ./configure "${ARGS[@]}"
emmake make -j$(nproc)
emmake make install