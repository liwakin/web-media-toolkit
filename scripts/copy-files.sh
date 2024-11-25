TEMP_CONTAINER_NAME=copy_container.temp
OUTPUT_DIR=output

docker create --name ${TEMP_CONTAINER_NAME} ffmpeg_wasm:latest > /dev/null 2>&1

mkdir -p ./${OUTPUT_DIR}

docker cp ${TEMP_CONTAINER_NAME}:/src/ffmpeg/ffmpeg.js ${OUTPUT_DIR}/ffmpeg.js
docker cp ${TEMP_CONTAINER_NAME}:/src/ffmpeg/ffmpeg.wasm ${OUTPUT_DIR}/ffmpeg.wasm

docker rm -f ${TEMP_CONTAINER_NAME} > /dev/null 2>&1

echo "Files copied to ${OUTPUT_DIR}" 