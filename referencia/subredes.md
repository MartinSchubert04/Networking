# Subredes

## Tabla rápida

| CIDR | Máscara | Direcciones | Hosts usables |
|---|---|---|---|
| /24 | 255.255.255.0 | 256 | 254 |
| /25 | 255.255.255.128 | 128 | 126 |
| /26 | 255.255.255.192 | 64 | 62 |
| /27 | 255.255.255.224 | 32 | 30 |
| /28 | 255.255.255.240 | 16 | 14 |
| /29 | 255.255.255.248 | 8 | 6 |
| /30 | 255.255.255.252 | 4 | 2 |
| /16 | 255.255.0.0 | 65 536 | 65 534 |
| /8 | 255.0.0.0 | 16 777 216 | 16 777 214 |

Hosts usables = direcciones − 2, porque la primera es la **dirección de red** y la última es la de **broadcast**.

## Ejemplo: `192.168.0.0/24`

- Red: `192.168.0.0`
- Primer host: `192.168.0.1` (suele ser el router)
- Último host: `192.168.0.254`
- Broadcast: `192.168.0.255`

Un dispositivo en `192.168.1.42/24` está en **otra red** (`192.168.1.0/24`): para hablar con `192.168.0.x` necesita pasar por un router que conozca las dos.

## Cómo calcularlo a mano

1. Pasar la máscara a bits: `/26` = 26 unos y 6 ceros.
2. El "tamaño de bloque" es `2^(bits en cero)`: `2^6 = 64`.
3. Las redes empiezan en múltiplos del bloque: `.0`, `.64`, `.128`, `.192`.
4. La IP `192.168.0.100/26` cae en el bloque que empieza en `.64` → red `192.168.0.64`, broadcast `192.168.0.127`.

## Rangos privados (RFC 1918)

| Rango | CIDR |
|---|---|
| 10.0.0.0 – 10.255.255.255 | 10.0.0.0/8 |
| 172.16.0.0 – 172.31.255.255 | 172.16.0.0/12 |
| 192.168.0.0 – 192.168.255.255 | 192.168.0.0/16 |

Otros que vas a ver: `127.0.0.0/8` (loopback), `169.254.0.0/16` (sin DHCP), `100.64.0.0/10` (CGNAT; Tailscale usa IPs de acá).
