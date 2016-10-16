import main as api

botname = 'testes'
host = 'demobots.pandorabots.com'
app_id = 'barryadmin'
userkey = 'pb133791216035704322186374406597679239884'

print api.upload_file(userkey,app_id,host,botname,'test/a.aiml')

