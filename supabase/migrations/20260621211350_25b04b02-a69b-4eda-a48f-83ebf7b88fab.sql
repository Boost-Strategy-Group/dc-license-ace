
UPDATE public.tenants SET
  name = 'Camden County Council on Economic Opportunity',
  slug = 'cccoeo',
  logo_url = '/__l5e/assets-v1/3e1dd4cd-45ff-4ead-bbfe-eca97b3adbe8/cccoeo-logo.png',
  brand_primary = '#1F3A8A',
  brand_secondary = '#E5ECF7',
  welcome_copy = 'Workforce development and economic opportunity training for Camden County, powered by BOOST.',
  settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{website_url}', '"https://cccoeo.org"')
WHERE slug = 'client-one';

UPDATE public.tenants SET
  name = 'CCCC Counseling',
  slug = 'cccc',
  logo_url = '/__l5e/assets-v1/80fc5c48-7484-4b90-9948-e436264229e9/cccc-logo.jpeg',
  brand_primary = '#7BB7B5',
  brand_secondary = '#0B0B0B',
  welcome_copy = 'Clinical training and continuing education, rooted in our community.',
  settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{website_url}', '"https://www.ccccmentalhealth.com/services"')
WHERE slug = 'client-two';

UPDATE public.tenants SET
  name = 'Eskaton Consulting',
  slug = 'eskaton',
  logo_url = '/__l5e/assets-v1/d3e74272-2e71-4022-a0a5-b3426ae5cd32/eskaton-logo.jpeg',
  brand_primary = '#F08A24',
  brand_secondary = '#111111',
  welcome_copy = 'Leadership, strategy, and workforce development training from Eskaton Consulting.',
  settings = jsonb_set(coalesce(settings,'{}'::jsonb), '{website_url}', '"https://eskatonconsulting.com"')
WHERE slug = 'client-three';
