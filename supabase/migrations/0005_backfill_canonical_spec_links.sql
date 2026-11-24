-- Backfill verified direct canonical spec_url and spec_links across existing CPUs,
-- GPUs, computers (motherboard, gpu_aib, laptop, wifi), and storage drives.
-- Idempotent and natural-key matched (no hardcoded IDs).

-- 1. Backfill CPUs
update public.cpus set
  spec_url = 'https://www.intel.com/content/www/us/en/products/sku/186605/intel-core-i99900k-processor-16m-cache-up-to-5-00-ghz/specifications.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i9-9900K+%40+3.60GHz&id=3334"}]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core i9 9900k';

update public.cpus set
  spec_url = 'https://www.amd.com/en/products/processors/desktops/ryzen/5000-series/amd-ryzen-5-5600x.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=AMD+Ryzen+5+5600X&id=3859"}]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'ryzen 5 5600x';

update public.cpus set
  spec_url = 'https://www.amd.com/en/support/downloads/drivers.html/processors/ryzen/ryzen-2000-series/amd-ryzen-3-2200g.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=AMD+Ryzen+3+2200G&id=3186"}]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'ryzen 3 2200g';

update public.cpus set
  spec_url = 'https://www.intel.com/content/www/us/en/products/sku/80810/intel-core-i54690-processor-6m-cache-up-to-3-90-ghz/specifications.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i5-4690+%40+3.50GHz&id=2236"}]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core i5-4690';

update public.cpus set
  spec_url = 'https://www.cpubenchmark.net/cpu.php?cpu=AMD+Phenom+II+X4+965&id=370',
  spec_links = '[]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'phenom ii x4 965';

update public.cpus set
  spec_url = 'https://www.cpubenchmark.net/cpu.php?cpu=AMD+Phenom+II+X4+830&id=356',
  spec_links = '[]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'phenom ii x4 830';

update public.cpus set
  spec_url = 'https://www.cpubenchmark.net/cpu.php?cpu=AMD+Athlon+II+X4+620&id=166',
  spec_links = '[]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'athlon ii x4 620';

update public.cpus set
  spec_url = 'https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core2+Quad+Q8200+%40+2.33GHz&id=1040',
  spec_links = '[]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core 2 quad q8200';

update public.cpus set
  spec_url = 'https://www.intel.com/content/www/us/en/products/sku/68316/intel-core-i53470-processor-6m-cache-up-to-3-60-ghz/specifications.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i5-3470+%40+3.20GHz&id=822"}]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core i5-3470';

update public.cpus set
  spec_url = 'https://www.cpubenchmark.net/cpu.php?cpu=Intel+Xeon+X5260+%40+3.33GHz&id=1292',
  spec_links = '[]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'xeon x5260';

update public.cpus set
  spec_url = 'https://www.cpubenchmark.net/cpu.php?cpu=AMD+FX-8350+Eight-Core&id=1780',
  spec_links = '[]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'fx-8350 black edition';

update public.cpus set
  spec_url = 'https://www.amd.com/en/products/processors/laptop/ryzen/8000-series/amd-ryzen-9-8945hs.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=AMD+Ryzen+9+8945HS&id=5926"}]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'ryzen 9 8945hs';

update public.cpus set
  spec_url = 'https://www.amd.com/en/support/downloads/drivers.html/processors/ryzen/ryzen-4000-series/amd-ryzen-9-4900hs.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=AMD+Ryzen+9+4900HS&id=3694"}]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'ryzen 9 4900hs';

update public.cpus set
  spec_url = 'https://www.intel.com/content/www/us/en/products/sku/97185/intel-core-i77700hq-processor-6m-cache-up-to-3-80-ghz/specifications.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i7-7700HQ+%40+2.80GHz&id=2906"}]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core i7 7700hq';

update public.cpus set
  spec_url = 'https://www.intel.com/content/www/us/en/products/sku/88967/intel-core-i76700hq-processor-6m-cache-up-to-3-50-ghz/specifications.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i7-6700HQ+%40+2.60GHz&id=2586"}]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core i7 6700hq';

update public.cpus set
  spec_url = 'https://www.intel.com/content/www/us/en/products/sku/75117/intel-core-i74700mq-processor-6m-cache-up-to-3-40-ghz/specifications.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i7-4700MQ+%40+2.40GHz&id=1923"}]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core i7-4700mq';

update public.cpus set
  spec_url = 'https://www.intel.com/content/www/us/en/products/sku/72164/intel-core-i53230m-processor-3m-cache-up-to-3-20-ghz-rpga/specifications.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i5-3230M+%40+2.60GHz&id=1849"}]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core i5 3230m';

update public.cpus set
  spec_url = 'https://www.intel.com/content/www/us/en/products/sku/75128/intel-core-i74800mq-processor-6m-cache-up-to-3-70-ghz/specifications.html',
  spec_links = '[{"label":"PassMark CPU Mark","url":"https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i7-4800MQ+%40+2.70GHz&id=1927"}]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core i7 4800mq';

update public.cpus set
  spec_url = 'https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i7-720QM+%40+1.60GHz&id=851',
  spec_links = '[]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core i7 720qm';

update public.cpus set
  spec_url = 'https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core2+Duo+T9550+%40+2.66GHz&id=1011',
  spec_links = '[]'::jsonb
where lower(brand) = 'intel' and lower(name) = 'core 2 duo t9550';

-- 2. Backfill GPUs
update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-rtx-2080-ti.c3305',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+RTX+2080+Ti&id=3991"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce rtx 2080 ti' and is_mobile = false;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/radeon-rx-580.c2938',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=Radeon+RX+580&id=3736"}]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'radeon rx 580' and is_mobile = false;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-gtx-465.c266',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+465&id=82"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce gtx 465' and is_mobile = false;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-gtx-660.c895',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+660&id=2152"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce gtx 660' and is_mobile = false;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-gtx-970.c2620',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+970&id=2954"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce gtx 970' and is_mobile = false;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/radeon-hd-7770-ghz-edition.c308',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=Radeon+HD+7770&id=322"}]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'radeon hd 7770 vapor-x oc' and is_mobile = false;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/radeon-hd-6670.c406',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=Radeon+HD+6670&id=96"}]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'radeon hd 6670' and is_mobile = false;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/radeon-rx-6400.c3813',
  spec_links = '[{"label":"AMD Official","url":"https://www.amd.com/en/products/graphics/desktops/radeon/6000-series/amd-radeon-rx-6400.html"},{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=Radeon+RX+6400&id=4536"}]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'radeon rx 6400' and is_mobile = false;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-rtx-4070-mobile.c3944',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+RTX+4070+Laptop+GPU&id=4756"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce rtx 4070' and is_mobile = true;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-rtx-2060-max-q.c3533',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+RTX+2060+with+Max-Q+Design&id=4199"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce rtx 2060 max-q' and is_mobile = true;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-gtx-1050-mobile.c2917',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+1050+%28Mobile%29&id=4088"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce gtx 1050' and is_mobile = true;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-gtx-960m.c2635',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+960M&id=3176"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce gtx 960m' and is_mobile = true;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-gt-755m.c2420',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GT+755M&id=2646"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce gt 755m' and is_mobile = true;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-gtx-660m.c345',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+660M&id=1458"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce gtx 660m' and is_mobile = true;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/radeon-hd-8790m.c1798',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=Radeon+HD+8790M&id=2993"}]'::jsonb
where lower(brand) = 'amd' and lower(name) = 'radeon hd 8790m' and is_mobile = true;

update public.gpus set
  spec_url = 'https://www.techpowerup.com/gpu-specs/geforce-gtx-260m.c1510',
  spec_links = '[{"label":"PassMark G3D Mark","url":"https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+260M&id=83"}]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'geforce gtx 260m' and is_mobile = true;

update public.gpus set
  spec_url = 'https://www.videocardbenchmark.net/gpu.php?gpu=Quadro+NVS+160M&id=1626',
  spec_links = '[]'::jsonb
where lower(brand) = 'nvidia' and lower(name) = 'quadro nvs 160m' and is_mobile = true;

-- 3. Backfill Computers part_spec_links (non-destructive merge preserving existing keys)
update public.computers
set part_spec_links = '{"motherboard":{"spec_url":"https://rog.asus.com/motherboards/rog-strix/rog-strix-z390-i-gaming-model/"}}'::jsonb || part_spec_links
where lower(coalesce(motherboard_name, '')) = 'rog strix z390-i'
  and not (part_spec_links ? 'motherboard');

update public.computers
set part_spec_links = '{"motherboard":{"spec_url":"https://rog.asus.com/motherboards/rog-strix/rog-strix-b450-i-gaming-model/"}}'::jsonb || part_spec_links
where lower(coalesce(motherboard_name, '')) = 'rog strix b450-i'
  and not (part_spec_links ? 'motherboard');

update public.computers
set part_spec_links = '{"motherboard":{"spec_url":"https://www.asus.com/motherboards-components/motherboards/prime/prime-b450m-a-ii/"}}'::jsonb || part_spec_links
where lower(coalesce(motherboard_name, '')) = 'prime b450m-a ii'
  and not (part_spec_links ? 'motherboard');

update public.computers
set part_spec_links = '{"gpu_aib":{"spec_url":"https://www.gigabyte.com/us/Graphics-Card/GV-N465UD-1GI/sp"}}'::jsonb || part_spec_links
where lower(coalesce(gpu_aib_model, '')) = 'gv-n465ud-1gi'
  and not (part_spec_links ? 'gpu_aib');

-- Laptops -> Notebookcheck reviews
update public.computers
set part_spec_links = '{"laptop":{"spec_url":"https://www.notebookcheck.net/Asus-ROG-Zephyrus-G14-2024-GA403U.817916.0.html"}}'::jsonb || part_spec_links
where lower(coalesce(model, '')) = 'ga403ui-g14.r94070'
  and not (part_spec_links ? 'laptop');

update public.computers
set part_spec_links = '{"laptop":{"spec_url":"https://www.notebookcheck.net/Asus-Zephyrus-G14-Ryzen-9-GeForce-RTX-2060-Max-Q-Laptop-Review-Kicking-Core-i9-to-the-Curb.457817.0.html"}}'::jsonb || part_spec_links
where lower(coalesce(model, '')) = 'ga401iv-br9n6'
  and not (part_spec_links ? 'laptop');

update public.computers
set part_spec_links = '{"laptop":{"spec_url":"https://www.notebookcheck.net/Dell-XPS-15-9560-i7-7700HQ-UHD-Laptop-Review.200648.0.html"}}'::jsonb || part_spec_links
where lower(coalesce(model, '')) = 'xps 15 9560'
  and not (part_spec_links ? 'laptop');

update public.computers
set part_spec_links = '{"laptop":{"spec_url":"https://www.notebookcheck.net/Asus-GL552VW-Xotic-PC-Edition-Notebook-Review.161464.0.html"}}'::jsonb || part_spec_links
where lower(coalesce(model, '')) = 'gl552vw'
  and not (part_spec_links ? 'laptop');

update public.computers
set part_spec_links = '{"laptop":{"spec_url":"https://www.notebookcheck.net/Review-Update-Lenovo-IdeaPad-Y510p-GT-755M-SLI-Notebook.107108.0.html"}}'::jsonb || part_spec_links
where lower(coalesce(model, '')) = 'y510p'
  and not (part_spec_links ? 'laptop');

update public.computers
set part_spec_links = '{"laptop":{"spec_url":"https://www.notebookcheck.net/Review-Asus-G46VW-Notebook.86486.0.html"}}'::jsonb || part_spec_links
where lower(coalesce(model, '')) = 'g46vw-bsi5n06'
  and not (part_spec_links ? 'laptop');

update public.computers
set part_spec_links = '{"laptop":{"spec_url":"https://www.notebookcheck.net/Review-Dell-Latitude-E6540-i7-4800MQ-HD-8790M-Notebook.97595.0.html"}}'::jsonb || part_spec_links
where lower(coalesce(model, '')) = 'latitude e6540'
  and not (part_spec_links ? 'laptop');

update public.computers
set part_spec_links = '{"laptop":{"spec_url":"https://www.notebookcheck.net/Asus-G51J-1B.24780.0.html"}}'::jsonb || part_spec_links
where lower(coalesce(model, '')) = 'g51j-a1'
  and not (part_spec_links ? 'laptop');

update public.computers
set part_spec_links = '{"laptop":{"spec_url":"https://www.notebookcheck.net/Review-Dell-Latitude-E6400-Notebook.12875.0.html"}}'::jsonb || part_spec_links
where lower(coalesce(model, '')) = 'latitude e6400'
  and not (part_spec_links ? 'laptop');

-- Wi-Fi adapters
update public.computers
set part_spec_links = '{"wifi":{"spec_url":"https://www.intel.com/content/www/us/en/products/sku/204836/intel-wifi-6e-ax210-gig/specifications.html"}}'::jsonb || part_spec_links
where lower(coalesce(wifi_model, '')) = 'ax210ngw'
  and not (part_spec_links ? 'wifi');

update public.computers
set part_spec_links = '{"wifi":{"spec_url":"https://www.intel.com/content/www/us/en/products/sku/189347/intel-wifi-6-ax200-gig/specifications.html"}}'::jsonb || part_spec_links
where lower(coalesce(wifi_model, '')) = 'ax200'
  and not (part_spec_links ? 'wifi');

update public.computers
set part_spec_links = '{"wifi":{"spec_url":"https://www.intel.com/content/www/us/en/ark/products/series/75620/intel-wireless-7200-series.html"}}'::jsonb || part_spec_links
where lower(coalesce(wifi_model, '')) in ('wireless-ac 7265', 'wireless-ac 7260')
  and not (part_spec_links ? 'wifi');

update public.computers
set part_spec_links = '{"wifi":{"spec_url":"https://www.intel.com/content/www/us/en/support/products/66890/wireless/legacy-intel-wireless-products/intel-wireless-series/intel-centrino-advanced-n-6235-dual-band.html"}}'::jsonb || part_spec_links
where lower(coalesce(wifi_model, '')) = 'advanced-n 6235'
  and not (part_spec_links ? 'wifi');

update public.computers
set part_spec_links = '{"wifi":{"spec_url":"https://www.intel.com/content/www/us/en/products/sku/66889/intel-centrino-wirelessn-2230-single-band/specifications.html"}}'::jsonb || part_spec_links
where lower(coalesce(wifi_model, '')) = 'wireless-n 2230'
  and not (part_spec_links ? 'wifi');

-- 4. Backfill Storage Drives
update public.storage_drives
set spec_url = 'https://webapi3.adata.com/storage/downloadfile/datasheet_xpg_sx8200_pro_pcie_gen3_x4_m2_ssd_20250225.pdf'
where lower(coalesce(model, '')) like '%sx8200 pro%'
  and spec_url is null;
