# 00_COM18_CONNECT_ONLY — K500 protocol quick analysis
## Transport
- Source: Standard Serial over Bluetooth link (COM18)
- Baud rate seen in log: 115200
- Line control: 8N1
- Device path indicates Bluetooth SPP/RFCOMM service `00001101-0000-1000-8000-00805f9b34fb`.
## Frame format observed
### PC → K500
`AA LL CMD PAYLOAD... CS`
- `LL` = number of bytes after `LL` and before checksum.
- Checksum: two-complement over `LL CMD PAYLOAD...`, so `sum(LL..CS) & 0xFF == 0`.
### K500 → PC
`55 LEN_LO LEN_HI RSP DATA... CS`
- `LEN` appears to count `RSP + DATA`.
- Checksum covers `LEN_LO LEN_HI RSP DATA...`, so `sum(LEN_LO..CS) & 0xFF == 0`.
- Response command is command complement: `0x1C → 0xE3`, `0x3F → 0xC0`, `0x40 → 0xBF`.
## Main connect sequence
- Ord 0039: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0051: `aa 01 3f c0` — handshake / pre-read; checksum=OK
- Ord 0059: `aa 06 40 00 00 3a 00 00 80` — read block offset=0x0000, len=58; checksum=OK
- Ord 0067: `aa 06 40 3a 00 3a 00 00 46` — read block offset=0x003A, len=58; checksum=OK
- Ord 0075: `aa 06 40 74 00 3a 00 00 0c` — read block offset=0x0074, len=58; checksum=OK
- Ord 0083: `aa 06 40 ae 00 3a 00 00 d2` — read block offset=0x00AE, len=58; checksum=OK
- Ord 0091: `aa 06 40 e8 00 3a 00 00 98` — read block offset=0x00E8, len=58; checksum=OK
- Ord 0099: `aa 06 40 22 01 3a 00 00 5d` — read block offset=0x0122, len=58; checksum=OK
- Ord 0107: `aa 06 40 5c 01 3a 00 00 23` — read block offset=0x015C, len=58; checksum=OK
- Ord 0115: `aa 06 40 96 01 3a 00 00 e9` — read block offset=0x0196, len=58; checksum=OK
- Ord 0123: `aa 06 40 d0 01 3a 00 00 af` — read block offset=0x01D0, len=58; checksum=OK
- Ord 0131: `aa 06 40 0a 02 3a 00 00 74` — read block offset=0x020A, len=58; checksum=OK
- Ord 0139: `aa 06 40 44 02 3a 00 00 3a` — read block offset=0x0244, len=58; checksum=OK
- Ord 0147: `aa 06 40 7e 02 3a 00 00 00` — read block offset=0x027E, len=58; checksum=OK
- Ord 0155: `aa 06 40 b8 02 3a 00 00 c6` — read block offset=0x02B8, len=58; checksum=OK
- Ord 0163: `aa 06 40 f2 02 3a 00 00 8c` — read block offset=0x02F2, len=58; checksum=OK
- Ord 0171: `aa 06 40 2c 03 3a 00 00 51` — read block offset=0x032C, len=58; checksum=OK
- Ord 0179: `aa 06 40 66 03 3a 00 00 17` — read block offset=0x0366, len=58; checksum=OK
- Ord 0187: `aa 06 40 a0 03 0b 00 00 0c` — read block offset=0x03A0, len=11; checksum=OK
- Ord 0195: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0207: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0219: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0235: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0243: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0255: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0267: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0275: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0287: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0299: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0307: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0319: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0331: `aa 01 1c e3` — heartbeat/status poll; checksum=OK
- Ord 0343: `aa 01 1c e3` — heartbeat/status poll; checksum=OK

## Readback map reconstructed
- Command `0x40` reads blocks: `AA 06 40 OFF_LO OFF_HI LEN_LO LEN_HI 00 CS`.
- Connect-only session reads 17 blocks from `0x0000` to `0x03AA`, total 939 bytes.
- Reconstructed binary saved as `connect_readback_0x0000_0x03ab.bin`.
- ASCII strings found include preset/device names such as `KARAOKE ARTIST`, `KTV_BT_00AB12`, and `KTV_BLE_00AB12`.
