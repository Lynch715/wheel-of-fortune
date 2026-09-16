# 把 art/万界 下的原图压成 index.html 里那一段 assets.js。
# 用法：python3 build.py（需要 Pillow），产出 assets.js，再把它整段替换回 index.html
# 里从 const AV_CELL= 起到 const ICON_IMG= 那一行为止。
# -*- coding: utf-8 -*-
import os,io,json,base64
from PIL import Image
A=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.join(A,'assets.js')
def b64(buf,mime='image/webp'): return 'data:%s;base64,%s'%(mime,base64.b64encode(buf).decode())

# ---- 头像图集 ----
names=sorted([f[:-4] for f in os.listdir(A+'/avatars') if f.endswith('.png')])
CELL,COLS=128,10
ROWS=(len(names)+COLS-1)//COLS
sheet=Image.new('RGB',(CELL*COLS,CELL*ROWS),(233,228,216))
for i,n in enumerate(names):
    im=Image.open(f'{A}/avatars/{n}.png').convert('RGB').resize((CELL,CELL),Image.LANCZOS)
    sheet.paste(im,((i%COLS)*CELL,(i//COLS)*CELL))
b=io.BytesIO(); sheet.save(b,'WEBP',quality=70,method=6); AV=b.getvalue()

# ---- 说明 ----
desc={}
for line in io.open(os.path.join(A,'desc.txt'),encoding='utf-8'):
    line=line.strip()
    if not line: continue
    k,v=line.split('|',1); desc[k]=v
missing=[n for n in names if n not in desc]
if missing: print('WARN 缺说明:',missing)

# ---- 场景 ----
scs=sorted([f[:-4] for f in os.listdir(A+'/scenes') if f.endswith('.png')])
SC={}
for n in scs:
    im=Image.open(f'{A}/scenes/{n}.png').convert('RGB').resize((640,213),Image.LANCZOS)
    b=io.BytesIO(); im.save(b,'WEBP',quality=45,method=6); SC[n]=b64(b.getvalue())

# ---- 封面 / 图标 ----
# ---- 转轮：不再打包 ----
# 投胎页原来画一只会转的轮（wheel.png + 量徽记角度 + WHEEL_ANGLE），2026-09-16 撤掉了：
# 轮画得好，但每停一格都得转到那个角度，看着总是斜的。现在五个界直接列按钮，
# 配那一界的界景。wheel.png 和归一化那段代码都还在 git 里，要找回来看那次提交。
import math
b=io.BytesIO(); Image.open(f'{A}/cover.png').convert('RGB').resize((760,399),Image.LANCZOS).save(b,'WEBP',quality=62,method=6)
COVER=b64(b.getvalue())
b=io.BytesIO(); Image.open(f'{A}/app_icon.png').convert('RGBA').resize((192,192),Image.LANCZOS).save(b,'PNG',optimize=True)
ICON=b64(b.getvalue(),'image/png')

# ---- 界景：投胎选界与换界过场 ----
JIE_KEY={'jie_d':'东荒','jie_w':'西陆','jie_s':'樱洲','jie_h':'轮枢','jie_a':'幽墟'}
JI={}
if os.path.isdir(A+'/jie'):
    for f in sorted(os.listdir(A+'/jie')):
        if not f.endswith('.png'): continue
        k=JIE_KEY.get(f[:-4])
        if not k: continue
        im=Image.open(f'{A}/jie/{f}').convert('RGB').resize((704,469),Image.LANCZOS)
        b=io.BytesIO(); im.save(b,'WEBP',quality=46,method=6); JI[k]=b64(b.getvalue())

# ---- 轮外之物：透明底，用在决战与万界页 ----
OUTER=''
if os.path.exists(A+'/outer.png'):
    im=Image.open(A+'/outer.png').convert('RGBA')
    im.thumbnail((460,690),Image.LANCZOS)
    b=io.BytesIO(); im.save(b,'WEBP',quality=56,method=6); OUTER=b64(b.getvalue())

# ---- 立绘：按头像桶名存，画了哪个就用哪个，没画的退回小头像 ----
POR={}
if os.path.isdir(A+'/portraits'):
    for f in sorted(os.listdir(A+'/portraits')):
        if not f.endswith('.png'): continue
        im=Image.open(f'{A}/portraits/{f}').convert('RGBA')
        im=im.crop(im.split()[3].getbbox())          # 去掉四周的空白
        im.thumbnail((400,600),Image.LANCZOS)   # 面谈那一列最宽 190px，两倍屏要 380，400 够了
        b=io.BytesIO(); im.save(b,"WEBP",quality=62,method=6); POR[f[:-4]]=b64(b.getvalue())

js=[]
js.append('/* ================= 美术资产（S4 接入，由 art/ 下的原图压出来） ================= */')
js.append('const AV_CELL=%d, AV_COLS=%d, AV_ROWS=%d, AV_ZOOM=1.04;'%(CELL,COLS,ROWS))   # AV_ZOOM：头像框放大 4%%，裁掉格子边的串色
js.append('const AV_SLOTS='+json.dumps(names,ensure_ascii=False)+';')
js.append("const AV_SHEET='"+b64(AV)+"';")
js.append('const AV_DESC='+json.dumps({n:desc.get(n,'') for n in names},ensure_ascii=False)+';')
js.append('const SCENE_IMG='+json.dumps(SC,ensure_ascii=False)+';')
js.append("const COVER_IMG='"+COVER+"';")
js.append("const ICON_IMG='"+ICON+"';")
js.append('const JIE_IMG='+json.dumps(JI,ensure_ascii=False)+';')
js.append("const OUTER_IMG='"+OUTER+"';")
js.append('const POR_IMG='+json.dumps(POR,ensure_ascii=False)+';')
io.open(OUT,'w',encoding='utf-8').write('\n'.join(js)+'\n')
print('图集 %dx%d cell=%d  webp %d KB'%(COLS,ROWS,CELL,len(AV)//1024))
print('场景 %d 张 %d KB'%(len(SC),sum(len(v) for v in SC.values())//1024))
print('封面 %d KB  图标 %d KB'%(len(COVER)//1024,len(ICON)//1024))
print('界景 %d 张 %d KB  轮外之物 %d KB  立绘 %d 张 %d KB'%(len(JI),sum(len(v) for v in JI.values())//1024,len(OUTER)//1024,len(POR),sum(len(v) for v in POR.values())//1024))
print('assets.js 总 %d KB'%(os.path.getsize(OUT)//1024))
