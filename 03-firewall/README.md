# 03 · Firewall y segmentación

Objetivo: entender cómo se separa y protege una red.

## Base del lab

Una VM con **OPNsense** en el server (KVM) que hace de router de una red de lab aislada: un bridge de Linux **sin placa física**, así nada de esto toca la red real.

- [ ] Crear el bridge aislado del lab (`lab0`)
- [ ] VM OPNsense con dos interfaces: WAN (salida controlada) y LAN (`lab0`)
- [ ] Una VM o contenedor cliente en `lab0` que reciba IP por DHCP de OPNsense

## Ejercicios

- [ ] Reglas de firewall: permitir solo lo necesario, bloquear el resto, ver los logs de bloqueos
- [ ] NAT de salida y port forward de entrada: entender la diferencia
- [ ] Dos segmentos (por ejemplo "usuarios" e "IoT") y reglas entre ellos
- [ ] VPN WireGuard hacia el lab
- [ ] Entender qué hace Tailscale por dentro (WireGuard + NAT traversal + coordinación)
- [ ] Activar Suricata (IDS) en OPNsense y disparar una alerta a propósito

## A futuro (opcional)

Con un switch gestionable barato (tipo TP-Link SG108E) se pueden hacer VLANs reales en casa, por ejemplo IoT separado del resto.

## Qué aprendí

(completar al terminar la fase)
