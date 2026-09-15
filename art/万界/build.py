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
# 出图的轮圆心不在画布中心，五枚徽牌也不是严格等分（最大差 2.4 度）。
# 这里量出五枚徽牌内盘的重心，用最小二乘拟一个正五边形，拿到圆心、半径和相位，
# 按相位转正、按圆心裁方。转正之后五辐就按 0/72/144/216/288 走整数格，
# 每停一格轮子的姿态一模一样；徽牌自身那点偏差是画出来的，转多少都去不掉。
import math
def wheel_normalize():
    src=Image.open(f'{A}/wheel.png').convert('RGBA'); W,H=src.size; px=src.load()
    ST=2; N=W//ST                                   # 隔一格取一个点，别缩图——缩图会把金线糊进盘面
    def is_gold(q):
        r,g,b,al=q
        return al>128 and r>90 and r-b>40 and g-b>15 and r>=g
    xs=[];ys=[]
    for y in range(N):
        for x in range(N):
            if px[x*ST,y*ST][3]>40: xs.append(x);ys.append(y)
    bx=(min(xs)+max(xs))/2; by=(min(ys)+max(ys))/2  # 外框只用来筛半径，不当圆心
    bR=max(max(xs)-min(xs),max(ys)-min(ys))/2
    # 徽牌内盘＝不透明、不是金色的连通块。轮箍上的石嵌也是这个颜色，
    # 但它是细长的弧，按外接框的填充率就能分开（弧 0.1 上下，圆盘 0.4 以上）。
    mask=[[(px[x*ST,y*ST][3]>128 and not is_gold(px[x*ST,y*ST])) for x in range(N)] for y in range(N)]
    seen=[[False]*N for _ in range(N)]
    blobs=[]
    for y0 in range(N):
        for x0 in range(N):
            if not mask[y0][x0] or seen[y0][x0]: continue
            st=[(x0,y0)]; seen[y0][x0]=True; sx=sy=n=0; x1=x2=x0; y1=y2=y0
            while st:
                x,y=st.pop(); sx+=x; sy+=y; n+=1
                if x<x1:x1=x
                if x>x2:x2=x
                if y<y1:y1=y
                if y>y2:y2=y
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    u,v=x+dx,y+dy
                    if 0<=u<N and 0<=v<N and mask[v][u] and not seen[v][u]:
                        seen[v][u]=True; st.append((u,v))
            if n<60: continue
            w=x2-x1+1; h=y2-y1+1
            if not(0.8<w/h<1.25) or n/(w*h)<0.30: continue
            rr=math.hypot(sx/n-bx,sy/n-by)/bR
            if not(0.5<rr<0.85): continue            # 正中那颗紫晶在 0.07，出局
            blobs.append((n,sx/n,sy/n))
    # 一枚徽牌常被盘面上的金线切成几块，先按位置并回去，再取最大的五团
    blobs.sort(reverse=True)
    cl=[]
    for n,x,y in blobs:
        for c in cl:
            if math.hypot(x-c[1]/c[0], y-c[2]/c[0])<0.10*bR:
                c[0]+=n; c[1]+=x*n; c[2]+=y*n; break
        else: cl.append([n,x*n,y*n])
    cl.sort(key=lambda c:-c[0])
    if len(cl)<5: raise SystemExit('转轮：只认出 %d 枚徽牌，换图了就得回来看这段'%len(cl))
    pts=[(c[1]/c[0]*ST, c[2]/c[0]*ST) for c in cl[:5]]
    # 最小二乘拟正五边形：圆心用局部搜索，相位／半径对给定圆心有闭式解
    def fit(cx,cy):
        q=sorted(pts,key=lambda p:(math.degrees(math.atan2(p[0]-cx,-(p[1]-cy))))%360)
        ang=[(math.degrees(math.atan2(x-cx,-(y-cy))))%360 for x,y in q]
        k=min(range(5),key=lambda i:abs((ang[i]+180)%360-180))   # 从最接近正上方那枚起
        q=q[k:]+q[:k]; ang=ang[k:]+ang[:k]
        sn=sum(math.sin(math.radians(ang[i]-i*72)) for i in range(5))
        cs=sum(math.cos(math.radians(ang[i]-i*72)) for i in range(5))
        phi=math.degrees(math.atan2(sn,cs))
        R=sum(math.hypot(x-cx,y-cy) for x,y in q)/5
        e=0
        for i,(x,y) in enumerate(q):
            th=math.radians(phi+i*72)
            e+=(x-(cx+R*math.sin(th)))**2+(y-(cy-R*math.cos(th)))**2
        return e,phi,R,ang
    cx=sum(p[0] for p in pts)/5; cy=sum(p[1] for p in pts)/5
    best=fit(cx,cy)[0]
    step=8.0
    while step>0.05:
        moved=False
        for dx,dy in ((step,0),(-step,0),(0,step),(0,-step)):
            e=fit(cx+dx,cy+dy)[0]
            if e<best: best,cx,cy=e,cx+dx,cy+dy; moved=True; break
        if not moved: step/=2
    e,phi,R,ang=fit(cx,cy)
    names=['东荒','樱洲','幽墟','轮枢','西陆']          # 照图上顺时针的实际排布
    dev=[round(((ang[i]-phi-i*72)+540)%360-180,2) for i in range(5)]
    print('转轮 圆心 %.1f,%.1f  半径 %.1f  相位 %.2f  徽牌偏差 %s  残差 %.1f px'
          %(cx,cy,R,phi,dev,math.sqrt(e/5)))
    far=0
    px=src.load()
    for y in range(0,H,2):
        for x in range(0,W,2):
            if px[x,y][3]>40:
                d=math.hypot(x-cx,y-cy)
                if d>far: far=d
    pad=int(far*1.03)
    box=src.crop((int(cx-pad),int(cy-pad),int(cx+pad),int(cy+pad)))
    box=box.rotate(phi, resample=Image.BICUBIC, expand=False)   # 正角度＝逆时针
    return box, {nm:i*72 for i,nm in enumerate(names)}
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
