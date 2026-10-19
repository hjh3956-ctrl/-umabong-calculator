"""Generate cross-language fixtures from the independent, ARM64-checked model."""
import sys,pathlib,json,random
BASE=pathlib.Path('/workspace/scratch/15c36d537591/rng_followup_20261018/restored/uma_reaudit_20261018')
sys.path.insert(0,str(BASE))
from engine import simulate,exact_distribution,allocation_metrics
OUT=pathlib.Path(__file__).resolve().parent
inventory=json.loads((BASE/'race_inventory.json').read_text())
native=json.loads((BASE/'engine_validation.json').read_text())
rng=random.Random(202610180400);traces=[];distributions=[]
def trace(name,roster,flags,p):
    result=simulate(roster,flags,p,True)
    traces.append(dict(name=name,roster=roster,flags=flags,pressure=p,
        ranks=result['final_rank'][0].tolist(),logs=result['logs']))
for race in inventory:
    for mode in range(3):
        flags=[[mode]*3 for _ in range(6)] if mode<2 else [[rng.randrange(2) for _ in range(3)] for _ in range(6)]
        pressure=0 if mode==0 else race['id']%6+1 if mode==1 else rng.randrange(7)
        trace(f"race{race['id']:02d}_{mode}",race['roster'],flags,pressure)
    distributions.append(dict(name=f"race{race['id']}",roster=race['roster'],pressure=race['id']%7,expected=exact_distribution(race['roster'],race['id']%7)))
traits=['SUPER_ GRIT','HIGH_SPEED','SUDDEN_START','PHYSICAL_CONTROL','COPPYCAT','SMART_PLAYER','HARD_WORKER','SPEED_CONTROL','DISRUPTER','PRESSURE_IMMUNITY']
for trait in traits:
    roster=[[9,5,1,-3,.3,0,'NONE'] for _ in range(6)]
    roster[1][-1]=roster[3][-1]='DISRUPTER';roster[2][-1]=trait
    for mode in range(2):
        flags=[[rng.randrange(2) for _ in range(3)] for _ in range(6)]
        trace(trait+str(mode),roster,flags,3 if mode else 0)
    distributions.append(dict(name=trait,roster=roster,pressure=3,expected=exact_distribution(roster,3)))
roster=[[9,5,1,-3,.3,0,tr] for tr in ['DISRUPTER','PHYSICAL_CONTROL','DISRUPTER','PHYSICAL_CONTROL','DISRUPTER','PHYSICAL_CONTROL']]
for i in range(5):
    trace('shared_physical_'+str(i),roster,[[rng.randrange(2) for _ in range(3)] for _ in range(6)],i)
distributions.append(dict(name='shared_physical',roster=roster,pressure=3,expected=exact_distribution(roster,3)))
forecast=json.loads(pathlib.Path('/workspace/scratch/15c36d537591/uma_race26_forecast_20261018.json').read_text())
for d in forecast['scenarios']:
    distributions.append(dict(name='race26_p'+str(d['pressure']),roster=forecast['roster'],pressure=d['pressure'],expected=d))
assert len(traces)==native['case_count']==100
for web,original in zip(traces,native['cases']):
    assert web['name']==original['name']
    assert web['flags']==original['flags'] and web['pressure']==original['pressure']
    assert web['ranks']==original['final_ranks'] and len(web['logs'])==original['log_count']
output=dict(traces=traces,distributions=distributions,native_log_count=native['matching_complete_log_count'])
(OUT/'fixtures.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')))
print(json.dumps(dict(trace_cases=len(traces),distribution_cases=len(distributions),native_logs=native['matching_complete_log_count'])))
