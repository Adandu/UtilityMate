import os
import re
import unicodedata

_filename_ascii_strip_re = re.compile(r"[^A-Za-z0-9_.-]")
_windows_device_files = (
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
)


def secure_filename(filename: str) -> str:
    """
    Sanitize a filename to ensure it is safe to use for storage on the filesystem.
    Inspired by Werkzeug's secure_filename.
    """
    if isinstance(filename, str):
        filename = (
            unicodedata.normalize("NFKD", filename)
            .encode("ascii", "ignore")
            .decode("ascii")
        )

    for sep in os.path.sep, os.path.altsep:
        if sep:
            filename = filename.replace(sep, " ")

    filename = str(_filename_ascii_strip_re.sub("_", "_".join(filename.split())))

    # Reduce multiple underscores to a single one
    filename = re.sub(r"_+", "_", filename)

    filename = filename.strip("._")

    if (
        os.name == "nt"
        and filename
        and filename.split(".")[0].upper() in _windows_device_files
    ):
        filename = f"_{filename}"

    return filename
