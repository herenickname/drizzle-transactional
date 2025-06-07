import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  Transactional,
  TransactionalClass,
} from "../dist/esm/decorators/transactional.js";
import { createTransactionalDatabaseProxy } from "../dist/esm/drizzle/database-manager.js";
import { IsolationLevel } from "../dist/esm/enums/isolation-level.js";
import { Propagation } from "../dist/esm/enums/propagation.js";
import {
  runOnTransactionCommit,
  runOnTransactionComplete,
  runOnTransactionRollback,
} from "../dist/esm/hooks/index.js";
import { comments, posts, users } from "./database-schema-postgres.js";

// Create a transactional database proxy for PostgreSQL
const db = createTransactionalDatabaseProxy("default") as NodePgDatabase<
  any,
  any
> & {
  isTransacting: boolean;
  baseDatabase: NodePgDatabase<any, any>;
};

/**
 * User service with transactional methods - now using real PostgreSQL
 */
export class UserService {
  @Transactional()
  async createUser(name: string, email: string): Promise<{ id: number }> {
    console.log(`Creating user: ${name} (${email})`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const result = await db
      .insert(users)
      .values({ name, email })
      .returning({ id: users.id });

    runOnTransactionCommit(() => {
      console.log(
        `✅ User ${name} successfully created with ID: ${result[0].id}`
      );
    });

    runOnTransactionRollback((error: any) => {
      console.log(`❌ Failed to create user ${name}: ${error.message}`);
    });

    return result[0];
  }

  @Transactional({ propagation: Propagation.REQUIRES_NEW })
  async getUserById(id: number) {
    console.log(`Getting user by ID: ${id}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] || null;
  }

  // Add missing methods for comprehensive test
  async findUserById(id: number) {
    return this.getUserById(id);
  }

  async getAllUsers() {
    console.log("Getting all users");
    const result = await db.select().from(users);
    return result;
  }

  @Transactional()
  async updateUserStatus(id: number, isActive: boolean): Promise<void> {
    console.log(`Updating user ${id} status to: ${isActive}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    await db.update(users).set({ isActive }).where(eq(users.id, id));

    runOnTransactionComplete((error: any) => {
      if (error) {
        console.log(`❌ Failed to update user ${id} status: ${error.message}`);
      } else {
        console.log(`✅ User ${id} status updated to: ${isActive}`);
      }
    });
  }

  @Transactional()
  async updateUserName(id: number, name: string): Promise<void> {
    console.log(`Updating user ${id} name to: ${name}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    await db.update(users).set({ name }).where(eq(users.id, id));

    runOnTransactionComplete((error: any) => {
      if (error) {
        console.log(`❌ Failed to update user ${id} name: ${error.message}`);
      } else {
        console.log(`✅ User ${id} name updated to: ${name}`);
      }
    });
  }

  @Transactional({ propagation: Propagation.NEVER })
  async getUserStats(): Promise<{ total: number; active: number }> {
    console.log("Getting user statistics (non-transactional)");
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const allUsers = await db.select().from(users);
    const activeUsers = allUsers.filter((user) => user.isActive);

    return {
      total: allUsers.length,
      active: activeUsers.length,
    };
  }
}

/**
 * Post service demonstrating class-level transactions
 */
@TransactionalClass({ isolationLevel: IsolationLevel.READ_COMMITTED })
export class PostService {
  async createPost(
    authorId: number,
    title: string,
    content: string
  ): Promise<{ id: number }> {
    console.log(`Creating post: ${title}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const result = await db
      .insert(posts)
      .values({ title, content, authorId })
      .returning({ id: posts.id });

    runOnTransactionCommit(() => {
      console.log(
        `✅ Post "${title}" successfully created with ID: ${result[0].id}`
      );
    });

    return result[0];
  }

  async publishPost(id: number): Promise<void> {
    console.log(`Publishing post: ${id}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    await db.update(posts).set({ published: true }).where(eq(posts.id, id));

    runOnTransactionCommit(() => {
      console.log(`✅ Post ${id} successfully published`);
    });
  }

  async getPostById(id: number) {
    console.log(`Getting post by ID: ${id}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const result = await db.select().from(posts).where(eq(posts.id, id));
    return result[0] || null;
  }

  // Add missing methods for comprehensive test
  async findPostById(id: number) {
    return this.getPostById(id);
  }

  async getAllPosts() {
    console.log("Getting all posts");
    const result = await db.select().from(posts);
    return result;
  }
}

/**
 * Blog service demonstrating complex transactional scenarios
 */
export class BlogService {
  constructor(
    private userService: UserService,
    private postService: PostService
  ) {}

  @Transactional()
  async createUserWithPost(
    userName: string,
    userEmail: string,
    postTitle: string,
    postContent: string
  ): Promise<{ userId: number; postId: number }> {
    console.log(`Creating user and post in transaction`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    // This will reuse the current transaction due to REQUIRED propagation
    const user = await this.userService.createUser(userName, userEmail);
    const post = await this.postService.createPost(
      user.id,
      postTitle,
      postContent
    );

    runOnTransactionCommit(() => {
      console.log(
        `✅ Successfully created user ${user.id} and post ${post.id}`
      );
    });

    return {
      userId: user.id,
      postId: post.id,
    };
  }

  @Transactional()
  async createUserWithPostAndFail(
    userName: string,
    userEmail: string,
    postTitle: string,
    postContent: string
  ): Promise<void> {
    console.log(`Creating user and post but will fail`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const user = await this.userService.createUser(userName, userEmail);
    const post = await this.postService.createPost(
      user.id,
      postTitle,
      postContent
    );

    runOnTransactionRollback((error: any) => {
      console.log(
        `❌ Transaction rolled back for user ${user.id} and post ${post.id}: ${error.message}`
      );
    });

    // This will cause the entire transaction to rollback
    throw new Error("Simulated failure after creating user and post");
  }

  @Transactional({ propagation: Propagation.MANDATORY })
  async addComment(
    postId: number,
    authorId: number,
    content: string
  ): Promise<{ id: number }> {
    console.log(`Adding comment to post ${postId}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    // This method requires an existing transaction
    const result = await db
      .insert(comments)
      .values({ postId, authorId, content })
      .returning({ id: comments.id });

    return result[0];
  }

  @Transactional()
  async createPostWithComment(
    authorId: number,
    postTitle: string,
    postContent: string,
    commentContent: string
  ): Promise<{ postId: number; commentId: number }> {
    console.log(`Creating post with comment`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const post = await this.postService.createPost(
      authorId,
      postTitle,
      postContent
    );

    // This will work because we're already in a transaction (MANDATORY propagation)
    const comment = await this.addComment(post.id, authorId, commentContent);

    return {
      postId: post.id,
      commentId: comment.id,
    };
  }
}

/**
 * Transaction isolation testing service with PostgreSQL features
 */
export class IsolationTestService {
  @Transactional({ isolationLevel: IsolationLevel.READ_COMMITTED })
  async createUserWithIsolationLevel(
    name: string,
    email: string,
    isolationLevel: (typeof IsolationLevel)[keyof typeof IsolationLevel]
  ): Promise<{ id: number; transactionId: string | null }> {
    console.log(`Creating user with isolation level: ${isolationLevel}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    // Get transaction ID for verification - now using real PostgreSQL function
    const baseDb = (db as any).baseDatabase;
    const txnResult = await baseDb.query("SELECT txid_current() as txn_id");
    const transactionId = txnResult.rows[0]?.txn_id?.toString() || null;

    const result = await db
      .insert(users)
      .values({ name, email })
      .returning({ id: users.id });

    console.log(
      `✅ User ${name} created with transaction ID: ${transactionId}`
    );

    return {
      id: result[0].id,
      transactionId,
    };
  }

  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async createUserSerializable(
    name: string,
    email: string
  ): Promise<{ id: number }> {
    console.log(`Creating user in SERIALIZABLE transaction: ${name}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const result = await db
      .insert(users)
      .values({ name, email })
      .returning({ id: users.id });

    return result[0];
  }

  @Transactional({ isolationLevel: IsolationLevel.REPEATABLE_READ })
  async createUserRepeatableRead(
    name: string,
    email: string
  ): Promise<{ id: number }> {
    console.log(`Creating user in REPEATABLE_READ transaction: ${name}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const result = await db
      .insert(users)
      .values({ name, email })
      .returning({ id: users.id });

    return result[0];
  }

  @Transactional()
  async createTestUser(name: string, email: string): Promise<{ id: number }> {
    console.log(`Creating test user: ${name} (${email})`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const result = await db
      .insert(users)
      .values({ name, email })
      .returning({ id: users.id });

    console.log(
      `✅ Test user ${name} successfully created with ID: ${result[0].id}`
    );
    return result[0];
  }

  async isTransacting(): Promise<boolean> {
    return (db as any).isTransacting || false;
  }

  async getTransactionId(): Promise<string | null> {
    try {
      const baseDb = (db as any).baseDatabase;
      const txnResult = await baseDb.query("SELECT txid_current() as txn_id");
      return txnResult.rows[0]?.txn_id?.toString() || null;
    } catch (error) {
      console.log("Could not get transaction ID:", error);
      return null;
    }
  }

  async getUserCount(): Promise<number> {
    const result = await db.select().from(users);
    return result.length;
  }

  async getRawUserCount(): Promise<number> {
    // Use base database to bypass transaction proxy
    const baseDb = (db as any).baseDatabase;
    const result = await baseDb.query("SELECT COUNT(*) as count FROM users");
    return parseInt(result.rows[0]?.count || "0");
  }

  // Add missing methods for comprehensive test
  async createTestRecord(
    name: string,
    description: string
  ): Promise<{ id: number }> {
    console.log(`Creating test record: ${name} - ${description}`);
    console.log(`Is transacting: ${(db as any).isTransacting}`);

    const result = await db
      .insert(users)
      .values({ name, email: `${name}@test.com` })
      .returning({ id: users.id });

    console.log(
      `✅ Test record ${name} successfully created with ID: ${result[0].id}`
    );
    return result[0];
  }

  async getAllRecords() {
    console.log("Getting all test records");
    const result = await db.select().from(users);
    return result;
  }
}
