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

# ---- 转轮 / 封面 / 图标 ----
# ---- 转轮：归一化 + 量徽记角度 ----
# 出图的轮在画布里不居中（圆心 y 偏上），五个徽记也不是严格等分，
# 直接用就会「指针对不上」。这里先把圆心摆正、裁成正方形，再转到东荒＝正上方，
# 最后把量到的角度写进 WHEEL_ANGLE，代码按这张表定位和分扇区。
import math
def wheel_normalize():
    src=Image.open(f'{A}/wheel.png').convert('RGBA'); W,H=src.size; px=src.load()
    xs=[];ys=[]
    for y in range(0,H,3):
        for x in range(0,W,3):
            if px[x,y][3]>40: xs.append(x);ys.append(y)
    cx=(min(xs)+max(xs))/2; cy=(min(ys)+max(ys))/2
    R=max(max(xs)-min(xs),max(ys)-min(ys))/2
    def is_gold(q):
        r,g,b,al=q
        return al>150 and r>110 and g>80 and b<r-35
    names=['东荒','樱洲','幽墟','轮枢','西陆']     # 照图上顺时针的实际排布
    def medallions(cx,cy,R):
        pts=[]
        for i in range(5):
            th=math.radians(i*72-90); rr=0.72*R
            ux,uy=cx+rr*math.cos(th), cy+rr*math.sin(th)
            for _ in range(4):                      # 往金环的重心收敛
                sx=sy=n=0; win=int(0.19*R)
                for y in range(int(uy-win),int(uy+win)):
                    for x in range(int(ux-win),int(ux+win)):
                        if 0<=x<W and 0<=y<H and math.hypot(x-ux,y-uy)<win and is_gold(px[x,y]):
                            sx+=x; sy+=y; n+=1
                if n: ux,uy=sx/n,sy/n
            pts.append((ux,uy))
        return pts
    # 圆心改用五枚徽牌的重心：外框会被轮箍上支出的尖角和裁切带偏，徽牌不会
    pts=medallions(cx,cy,R)
    for _ in range(2):
        cx=sum(p[0] for p in pts)/5; cy=sum(p[1] for p in pts)/5
        R=(sum(math.hypot(p[0]-cx,p[1]-cy) for p in pts)/5)/0.72
        pts=medallions(cx,cy,R)
    cx=sum(p[0] for p in pts)/5; cy=sum(p[1] for p in pts)/5
    ang={nm:(math.degrees(math.atan2(p[0]-cx,-(p[1]-cy)))+360)%360 for nm,p in zip(names,pts)}
    # 外沿半径按真正量到的最远不透明像素算，裁出来才不会缺角
    far=0
    for y in range(0,H,2):
        for x in range(0,W,2):
            if px[x,y][3]>40:
                d=math.hypot(x-cx,y-cy)
                if d>far: far=d
    off=ang['东荒']                                  # 转到东荒正上方
    pad=int(far*1.02)
    box=src.crop((int(cx-pad),int(cy-pad),int(cx+pad),int(cy+pad)))
    box=box.rotate(off, resample=Image.BICUBIC, expand=False)   # 正角度＝逆时针
    ang={k:round((v-off)%360,1) for k,v in ang.items()}
    return box, ang
wheel_img, WHEEL_ANGLE = wheel_normalize()
b=io.BytesIO(); wheel_img.resize((512,512),Image.LANCZOS).save(b,'WEBP',quality=80,method=6)
WHEEL=b64(b.getvalue())
b=io.BytesIO(); Image.open(f'{A}/cover.png').convert('RGB').resize((760,399),Image.LANCZOS).save(b,'WEBP',quality=62,method=6)
COVER=b64(b.getvalue())
b=io.BytesIO(); Image.open(f'{A}/app_icon.png').convert('RGBA').resize((192,192),Image.LANCZOS).save(b,'PNG',optimize=True)
ICON=b64(b.getvalue(),'image/png')

# ---- 界景：转轮选界与换界过场 ----
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
        im.thumbnail((440,660),Image.LANCZOS)
        b=io.BytesIO(); im.save(b,'WEBP',quality=70,method=6); POR[f[:-4]]=b64(b.getvalue())

js=[]
js.append('/* ================= 美术资产（S4 接入，由 art/ 下的原图压出来） ================= */')
js.append('const AV_CELL=%d, AV_COLS=%d, AV_ROWS=%d;'%(CELL,COLS,ROWS))
js.append('const AV_SLOTS='+json.dumps(names,ensure_ascii=False)+';')
js.append("const AV_SHEET='"+b64(AV)+"';")
js.append('const AV_DESC='+json.dumps({n:desc.get(n,'') for n in names},ensure_ascii=False)+';')
js.append('const SCENE_IMG='+json.dumps(SC,ensure_ascii=False)+';')
js.append('const WHEEL_ANGLE='+json.dumps(WHEEL_ANGLE,ensure_ascii=False)+';')
js.append("const WHEEL_IMG='"+WHEEL+"';")
js.append("const COVER_IMG='"+COVER+"';")
js.append("const ICON_IMG='"+ICON+"';")
js.append('const JIE_IMG='+json.dumps(JI,ensure_ascii=False)+';')
js.append("const OUTER_IMG='"+OUTER+"';")
js.append('const POR_IMG='+json.dumps(POR,ensure_ascii=False)+';')
io.open(OUT,'w',encoding='utf-8').write('\n'.join(js)+'\n')
print('图集 %dx%d cell=%d  webp %d KB'%(COLS,ROWS,CELL,len(AV)//1024))
print('场景 18 张  %d KB'%(sum(len(v) for v in SC.values())//1024))
print('转轮徽记角度',WHEEL_ANGLE)
print('转轮 %d KB  封面 %d KB  图标 %d KB'%(len(WHEEL)//1024,len(COVER)//1024,len(ICON)//1024))
print('界景 %d 张 %d KB  轮外之物 %d KB  立绘 %d 张 %d KB'%(len(JI),sum(len(v) for v in JI.values())//1024,len(OUTER)//1024,len(POR),sum(len(v) for v in POR.values())//1024))
print('assets.js 总 %d KB'%(os.path.getsize(OUT)//1024))
