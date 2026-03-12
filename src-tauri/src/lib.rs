use serde::{Deserialize, Serialize};
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;
use image::{RgbImage, Rgb};
use base64::{engine::general_purpose, Engine as _};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Room {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Dungeon {
    pub width: i32,
    pub height: i32,
    pub grid: Vec<Vec<i32>>, // 0=wall, 1=room, 2=corridor, 3=cave
    pub rooms: Vec<Room>,
}

#[tauri::command]
fn generate_dungeon(
    seed: u64,
    room_count: i32,
    corridor_width: f32,
    room_size: String,
    width: i32,
    height: i32,
    algorithm: String,
    room_padding: i32,
) -> Dungeon {
    let mut rng = StdRng::seed_from_u64(seed);
    let mut grid = vec![vec![0; width as usize]; height as usize];
    let mut rooms = Vec::new();

    match algorithm.as_str() {
        "rooms" | "bsp" => {
            let (min_room_size, max_room_size) = match room_size.as_str() {
                "small" => (4, 7),
                "medium" => (6, 12),
                "large" => (10, 18),
                _ => (6, 12),
            };

            let mut attempts = 0;
            while rooms.len() < room_count as usize && attempts < 500 {
                let w = rng.gen_range(min_room_size..=max_room_size);
                let h = rng.gen_range(min_room_size..=max_room_size);
                let x = rng.gen_range(1..width - w - 1);
                let y = rng.gen_range(1..height - h - 1);

                let new_room = Room { x, y, width: w, height: h };
                let mut intersect = false;
                
                for other in &rooms {
                    if rooms_intersect_padded(&new_room, other, room_padding) {
                        intersect = true;
                        break;
                    }
                }

                if !intersect {
                    for i in y..y + h {
                        for j in x..x + w {
                            grid[i as usize][j as usize] = 1;
                        }
                    }
                    rooms.push(new_room);
                }
                attempts += 1;
            }

            // MST-based connectivity
            if rooms.len() > 1 {
                let corridor_width_int = corridor_width.round() as i32;
                let mut edges = Vec::new();

                for i in 0..rooms.len() {
                    for j in i + 1..rooms.len() {
                        let r1 = &rooms[i];
                        let r2 = &rooms[j];
                        let dx = ((r1.x + r1.width / 2) - (r2.x + r2.width / 2)) as f32;
                        let dy = ((r1.y + r1.height / 2) - (r2.y + r2.height / 2)) as f32;
                        let dist = (dx * dx + dy * dy).sqrt();
                        edges.push((i, j, dist));
                    }
                }

                edges.sort_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal));

                let mut parent: Vec<usize> = (0..rooms.len()).collect();
                fn find(parent: &mut Vec<usize>, i: usize) -> usize {
                    if parent[i] == i { return i; }
                    parent[i] = find(parent, parent[i]);
                    parent[i]
                }

                let mut connections = 0;
                for (u, v, _) in edges {
                    let root_u = find(&mut parent, u);
                    let root_v = find(&mut parent, v);
                    if root_u != root_v {
                        parent[root_u] = root_v;
                        let r1 = &rooms[u];
                        let r2 = &rooms[v];
                        let start = (r1.x + r1.width / 2, r1.y + r1.height / 2);
                        let end = (r2.x + r2.width / 2, r2.y + r2.height / 2);
                        find_and_draw_path(&mut grid, start, end, corridor_width_int);
                        connections += 1;
                    }
                    if connections >= rooms.len() - 1 { break; }
                }
            }
        },
        "maze" => {
            // Recursive Backtracker Maze
            let mut stack = Vec::new();
            let start_x = (rng.gen_range(0..width / 2) * 2 + 1).min(width - 2);
            let start_y = (rng.gen_range(0..height / 2) * 2 + 1).min(height - 2);
            
            grid[start_y as usize][start_x as usize] = 2; // Use corridor color
            stack.push((start_x, start_y));

            while let Some((cx, cy)) = stack.last().copied() {
                let mut neighbors = Vec::new();
                for (dx, dy) in [(0, 2), (0, -2), (2, 0), (-2, 0)] {
                    let nx = cx + dx;
                    let ny = cy + dy;
                    if nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 {
                        if grid[ny as usize][nx as usize] == 0 {
                            neighbors.push((nx, ny));
                        }
                    }
                }

                if !neighbors.is_empty() {
                    let (nx, ny) = neighbors[rng.gen_range(0..neighbors.len())];
                    grid[ny as usize][nx as usize] = 2;
                    grid[(cy + (ny - cy) / 2) as usize][(cx + (nx - cx) / 2) as usize] = 2;
                    stack.push((nx, ny));
                } else {
                    stack.pop();
                }
            }
        },
        "ruins" => {
            // Scattered rooms connected by "caves"
            let (min_size, max_size) = (3, 6);
            let mut attempts = 0;
            while rooms.len() < room_count as usize && attempts < 300 {
                let w = rng.gen_range(min_size..=max_size);
                let h = rng.gen_range(min_size..=max_size);
                let x = rng.gen_range(1..width - w - 1);
                let y = rng.gen_range(1..height - h - 1);

                let new_room = Room { x, y, width: w, height: h };
                let mut intersect = false;
                for other in &rooms {
                    if rooms_intersect_padded(&new_room, other, 2) {
                        intersect = true;
                        break;
                    }
                }

                if !intersect {
                    for i in y..y + h {
                        for j in x..x + w {
                            grid[i as usize][j as usize] = 1;
                        }
                    }
                    rooms.push(new_room);
                }
                attempts += 1;
            }

            // Connect with "cave" tiles (3) using drunkard-style paths
            for i in 0..rooms.len() {
                let next = (i + 1) % rooms.len();
                let mut cx = rooms[i].x + rooms[i].width / 2;
                let mut cy = rooms[i].y + rooms[i].height / 2;
                let tx = rooms[next].x + rooms[next].width / 2;
                let ty = rooms[next].y + rooms[next].height / 2;

                while cx != tx || cy != ty {
                    if rng.gen_bool(0.5) {
                        if cx < tx { cx += 1; } else if cx > tx { cx -= 1; }
                    } else {
                        if cy < ty { cy += 1; } else if cy > ty { cy -= 1; }
                    }
                    if grid[cy as usize][cx as usize] == 0 {
                        grid[cy as usize][cx as usize] = 3;
                    }
                }
            }
        },
        "drunkard" => {
            let mut x = rng.gen_range(1..width - 1);
            let mut y = rng.gen_range(1..height - 1);
            let target_floor = (width * height) / 3;
            let mut floor_count = 0;

            while floor_count < target_floor {
                if grid[y as usize][x as usize] == 0 {
                    grid[y as usize][x as usize] = 3;
                    floor_count += 1;
                }

                let dir = rng.gen_range(0..4);
                match dir {
                    0 => if x > 1 { x -= 1; },
                    1 => if x < width - 2 { x += 1; },
                    2 => if y > 1 { y -= 1; },
                    _ => if y < height - 2 { y += 1; },
                }
            }
        },
        "caves" | "ca" => {
            for y in 0..height {
                for x in 0..width {
                    if rng.gen::<f32>() < 0.45 { grid[y as usize][x as usize] = 3; }
                }
            }
            for _ in 0..5 {
                let mut new_grid = grid.clone();
                for y in 1..height - 1 {
                    for x in 1..width - 1 {
                        let mut neighbors = 0;
                        for dy in -1..=1 {
                            for dx in -1..=1 {
                                if dx == 0 && dy == 0 { continue; }
                                if grid[(y + dy) as usize][(x + dx) as usize] == 3 { neighbors += 1; }
                            }
                        }
                        if neighbors > 4 { new_grid[y as usize][x as usize] = 3; }
                        else if neighbors < 4 { new_grid[y as usize][x as usize] = 0; }
                    }
                }
                grid = new_grid;
            }
        },
        "wfc" => {
            for y in (0..height - 1).step_by(2) {
                for x in (0..width - 1).step_by(2) {
                    let pattern = rng.gen_range(0..5);
                    match pattern {
                        0 => { // L-Shape
                            grid[y as usize][x as usize] = 1;
                            grid[(y + 1) as usize][x as usize] = 1;
                            grid[(y + 1) as usize][(x + 1) as usize] = 1;
                        },
                        1 => { // Horizontal
                            grid[y as usize][x as usize] = 2;
                            grid[y as usize][(x + 1) as usize] = 2;
                        },
                        2 => { // Vertical
                            grid[y as usize][x as usize] = 2;
                            grid[(y + 1) as usize][x as usize] = 2;
                        },
                        3 => { // Cross
                            grid[y as usize][x as usize] = 1;
                            grid[(y + 1) as usize][x as usize] = 2;
                            grid[y as usize][(x + 1) as usize] = 2;
                            grid[(y + 1) as usize][(x + 1) as usize] = 1;
                        },
                        _ => { // Single
                            grid[y as usize][x as usize] = 3;
                        }
                    }
                }
            }

            let mut regions: Vec<Vec<(i32, i32)>> = Vec::new();
            let mut visited = vec![vec![false; width as usize]; height as usize];

            for y in 0..height {
                for x in 0..width {
                    if grid[y as usize][x as usize] != 0 && !visited[y as usize][x as usize] {
                        let mut region = Vec::new();
                        let mut queue = std::collections::VecDeque::new();
                        queue.push_back((x, y));
                        visited[y as usize][x as usize] = true;

                        while let Some((cx, cy)) = queue.pop_front() {
                            region.push((cx, cy));
                            for (dx, dy) in [(0, 1), (0, -1), (1, 0), (-1, 0)] {
                                let nx = cx + dx;
                                let ny = cy + dy;
                                if nx >= 0 && nx < width && ny >= 0 && ny < height {
                                    if grid[ny as usize][nx as usize] != 0 && !visited[ny as usize][nx as usize] {
                                        visited[ny as usize][nx as usize] = true;
                                        queue.push_back((nx, ny));
                                    }
                                }
                            }
                        }
                        regions.push(region);
                    }
                }
            }

            if regions.len() > 1 {
                for i in 0..regions.len() - 1 {
                    let start = regions[i][0];
                    let end = regions[i+1][0];
                    find_and_draw_path(&mut grid, start, end, 1);
                }
            }
        },
        _ => {}
    }

    Dungeon { width, height, grid, rooms }
}

fn internal_export_png_bytes(dungeon: &Dungeon) -> Vec<u8> {
    let tile_size = 16;
    let img_width = dungeon.width as u32 * tile_size;
    let img_height = dungeon.height as u32 * tile_size;
    let mut img = RgbImage::new(img_width, img_height);

    for y in 0..dungeon.height {
        for x in 0..dungeon.width {
            let color = match dungeon.grid[y as usize][x as usize] {
                1 => Rgb([0, 212, 255]),
                2 => Rgb([74, 85, 104]),
                3 => Rgb([50, 150, 50]),
                _ => Rgb([11, 13, 23]),
            };
            for dy in 0..tile_size {
                for dx in 0..tile_size {
                    img.put_pixel(x as u32 * tile_size + dx, y as u32 * tile_size + dy, color);
                }
            }
        }
    }

    let mut bytes: Vec<u8> = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut bytes);
    img.write_to(&mut cursor, image::ImageFormat::Png).expect("Failed to write PNG");
    bytes
}

#[tauri::command]
fn export_png(dungeon: Dungeon) -> String {
    let bytes = internal_export_png_bytes(&dungeon);
    general_purpose::STANDARD.encode(&bytes)
}

#[tauri::command]
fn export_zip(dungeon: Dungeon, settings_json: String) -> String {
    use std::io::Write;
    let mut buf = Vec::new();
    {
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o755);

        // Add PNG
        zip.start_file("map.png", options).expect("Failed to start file");
        let png_bytes = internal_export_png_bytes(&dungeon);
        zip.write_all(&png_bytes).expect("Failed to write PNG to zip");

        // Add JSON
        zip.start_file("data.json", options).expect("Failed to start file");
        zip.write_all(settings_json.as_bytes()).expect("Failed to write JSON to zip");

        zip.finish().expect("Failed to finish zip");
    }

    general_purpose::STANDARD.encode(&buf)
}

// --- Helper functions ---
fn rooms_intersect_padded(r1: &Room, r2: &Room, padding: i32) -> bool {
    r1.x - padding <= r2.x + r2.width && r1.x + r1.width + padding >= r2.x &&
    r1.y - padding <= r2.y + r2.height && r1.y + r1.height + padding >= r2.y
}

fn find_and_draw_path(grid: &mut Vec<Vec<i32>>, start: (i32, i32), end: (i32, i32), width: i32) {
    let h = grid.len() as i32;
    let w = grid[0].len() as i32;
    
    let mut queue = std::collections::VecDeque::new();
    let mut came_from = std::collections::HashMap::new();
    
    queue.push_back(start);
    came_from.insert(start, None);
    
    let mut found = false;
    let mut final_pos = start;

    while let Some(current) = queue.pop_front() {
        if current == end {
            found = true;
            final_pos = current;
            break;
        }
        
        for (dx, dy) in [(0, 1), (0, -1), (1, 0), (-1, 0)] {
            let next = (current.0 + dx, current.1 + dy);
            if next.0 >= 0 && next.0 < w && next.1 >= 0 && next.1 < h {
                let cell = grid[next.1 as usize][next.0 as usize];
                if !came_from.contains_key(&next) && (cell == 0 || cell == 1 || cell == 2 || next == end) {
                    came_from.insert(next, Some(current));
                    queue.push_back(next);
                }
            }
        }
    }

    if found {
        let mut curr = final_pos;
        while let Some(prev) = came_from[&curr] {
            for dy in -width/2..width/2 + (width % 2) {
                for dx in -width/2..width/2 + (width % 2) {
                    let py = curr.1 + dy;
                    let px = curr.0 + dx;
                    if py >= 0 && py < h && px >= 0 && px < w {
                        if grid[py as usize][px as usize] == 0 {
                            grid[py as usize][px as usize] = 2;
                        }
                    }
                }
            }
            curr = prev;
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![generate_dungeon, export_png, export_zip])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}