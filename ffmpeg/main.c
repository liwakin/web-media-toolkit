#include <string.h>

#include "libavutil/log.h"

int ffmpeg_main(int argc, char **argv);
int ffprobe_main(int argc, char **argv);

int is_ffmpeg(const char *bin)
{
  return strcmp(bin, "ffmpeg") == 0;
}

int is_ffprobe(const char *bin)
{
  return strcmp(bin, "ffprobe") == 0;
}

int log_bin_error()
{
  av_log(NULL, AV_LOG_ERROR,
         "First argument must be either 'ffmpeg' or 'ffprobe'.\n");
}

int main(int argc, char **argv)
{
  if (argc <= 1)
  {
    return 0;
  }

  const char *bin = argv[1];
  if (is_ffmpeg(bin))
  {
    return ffmpeg_main(argc - 1, &argv[1]);
  }
  else if (is_ffprobe(bin))
  {
    return ffprobe_main(argc - 1, &argv[1]);
  }
  else
  {
    log_bin_error();
    return 1;
  }

  return 0;
}