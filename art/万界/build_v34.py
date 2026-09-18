# -*- coding: utf-8 -*-
# v3.4 压图：参数收紧一档，分组跑（device_bash 有时限），产出 parts/<组>.js
import os,io,json,base64,sys,time
from PIL import Image
A=os.path.dirname(os.path.abspath(__file__))
P=os.path.join(A,'parts'); os.makedirs(P,exist_ok=True)
def b64(buf,mime='image/webp'): return 'data:%s;base64,%s'%(mime,base64.b64encode(buf).decode())
def w(name,txt): io.open(os.path.join(P,name),'w',encoding='utf-8').write(txt+'\n'); print(name,len(txt)//1024,'KB(b64文本)')
g=sys.argv[1]; t0=time.time()
M=6

if g=='av':
    names=sorted([f[:-4] for f in os.listdir(A+'/avatars') if f.endswith('.png')])
    CELL,COLS=128,10
    ROWS=(len(names)+COLS-1)//COLS
    sheet=Image.new('RGB',(CELL*COLS,CELL*ROWS),(233,228,216))
    for i,n in enumerate(names):
        im=Image.open(f'{A}/avatars/{n}.png').convert('RGB').resize((CELL,CELL),Image.LANCZOS)
        sheet.paste(im,((i%COLS)*CELL,(i//COLS)*CELL))
    b=io.BytesIO(); sheet.save(b,'WEBP',quality=58,method=M); AV=b.getvalue()
    print('图集字节',len(AV)//1024,'KB')
    desc={}
    for line in io.open(os.path.join(A,'desc.txt'),encoding='utf-8'):
        line=line.strip()
        if not line: continue
        k,v=line.split('|',1); desc[k]=v
    miss=[n for n in names if n not in desc]
    if miss: print('WARN 缺说明:',miss)
    w('av.js','const AV_CELL=%d, AV_COLS=%d, AV_ROWS=%d, AV_ZOOM=1.04;\n'%(CELL,COLS,ROWS)
      +'const AV_SLOTS='+json.dumps(names,ensure_ascii=False)+';\n'
      +"const AV_SHEET='"+b64(AV)+"';\n"
      +'const AV_DESC='+json.dumps({n:desc.get(n,'') for n in names},ensure_ascii=False)+';')

if g=='sc':
    scs=sorted([f[:-4] for f in os.listdir(A+'/scenes') if f.endswith('.png')])
    SC={}
    for n in scs:
        im=Image.open(f'{A}/scenes/{n}.png').convert('RGB').resize((512,170),Image.LANCZOS)
        b=io.BytesIO(); im.save(b,'WEBP',quality=32,method=M); SC[n]=b64(b.getvalue())
    print('场景',len(SC),'张 字节',sum(len(v)*3//4 for v in SC.values())//1024,'KB')
    w('sc.js','const SCENE_IMG='+json.dumps(SC,ensure_ascii=False)+';')

if g=='por':
    POR={}
    for f in sorted(os.listdir(A+'/portraits')):
        if not f.endswith('.png'): continue
        im=Image.open(f'{A}/portraits/{f}').convert('RGBA')
        bb=im.split()[3].getbbox()
        if bb: im=im.crop(bb)
        im.thumbnail((320,480),Image.LANCZOS)
        b=io.BytesIO(); im.save(b,"WEBP",quality=46,method=M); POR[f[:-4]]=b64(b.getvalue())
    print('立绘',len(POR),'张 字节',sum(len(v)*3//4 for v in POR.values())//1024,'KB')
    w('por.js','const POR_IMG='+json.dumps(POR,ensure_ascii=False)+';')

if g=='misc':
    b=io.BytesIO(); Image.open(f'{A}/cover.png').convert('RGB').resize((640,336),Image.LANCZOS).save(b,'WEBP',quality=52,method=M)
    COVER=b64(b.getvalue()); print('封面',len(COVER)*3//4//1024,'KB')
    b=io.BytesIO(); Image.open(f'{A}/app_icon.png').convert('RGBA').resize((180,180),Image.LANCZOS).save(b,'PNG',optimize=True)
    ICON=b64(b.getvalue(),'image/png'); print('图标',len(ICON)*3//4//1024,'KB')
    JIE_KEY={'jie_d':'东荒','jie_w':'西陆','jie_s':'樱洲','jie_h':'轮枢','jie_a':'幽墟'}
    JI={}
    for f in sorted(os.listdir(A+'/jie')):
        if not f.endswith('.png'): continue
        k=JIE_KEY.get(f[:-4])
        if not k: continue
        im=Image.open(f'{A}/jie/{f}').convert('RGB').resize((600,400),Image.LANCZOS)
        b=io.BytesIO(); im.save(b,'WEBP',quality=40,method=M); JI[k]=b64(b.getvalue())
    print('界景',len(JI),'张',sum(len(v)*3//4 for v in JI.values())//1024,'KB')
    OUTER=''
    if os.path.exists(A+'/outer.png'):
        im=Image.open(A+'/outer.png').convert('RGBA'); im.thumbnail((380,570),Image.LANCZOS)
        b=io.BytesIO(); im.save(b,'WEBP',quality=48,method=M); OUTER=b64(b.getvalue())
    print('轮外之物',len(OUTER)*3//4//1024,'KB')
    w('misc.js',"const COVER_IMG='"+COVER+"';\nconst ICON_IMG='"+ICON+"';\n"
      +'const JIE_IMG='+json.dumps(JI,ensure_ascii=False)+';\n'
      +"const OUTER_IMG='"+OUTER+"';")
print('用时 %.1fs'%(time.time()-t0))
